import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAVE_HISTORICO, normalizarCep, formatarCep, consultarCep,
  lerHistorico, adicionarAoHistorico, textoDoEndereco,
} from '../cep.js';

const dadosApi = {
  cep: '01001-000', logradouro: 'Praça da Sé', bairro: 'Sé',
  localidade: 'São Paulo', uf: 'SP', estado: 'São Paulo',
};
const resposta = dados => async () => ({ ok: true, json: async () => dados });
const armazenamento = dados => ({ getItem(chave) { assert.equal(chave, CHAVE_HISTORICO); return dados; } });

test('aceita 8 números com ou sem hífen e preserva o zero inicial', () => {
  assert.equal(normalizarCep(' 01001-000 '), '01001000');
  assert.equal(normalizarCep('01001000'), '01001000');
  assert.equal(formatarCep('01001000'), '01001-000');
});

test('rejeita entradas inválidas antes de acessar a API', async () => {
  let chamadas = 0;
  for (const valor of ['', '123', '010010000', '01001abc', '01 001000', '01001/000']) {
    await assert.rejects(consultarCep(valor, async () => { chamadas++; }), /8 números/);
  }
  assert.equal(chamadas, 0);
});

test('consulta ViaCEP com fetch e normaliza o endereço recebido', async () => {
  const endereco = await consultarCep('01001-000', async (url, opcoes) => {
    assert.equal(url, 'https://viacep.com.br/ws/01001000/json/');
    assert.ok(opcoes.signal instanceof AbortSignal);
    return { ok: true, json: async () => dadosApi };
  });
  assert.equal(endereco.rua, 'Praça da Sé');
  assert.equal(endereco.cidade, 'São Paulo');
  assert.equal(textoDoEndereco(endereco), 'Praça da Sé, Sé, São Paulo - SP, CEP 01001-000');
});

test('informa quando um CEP válido não existe', async () => {
  await assert.rejects(consultarCep('99999999', resposta({ erro: true })), /CEP não encontrado/);
  await assert.rejects(consultarCep('99999999', resposta({ erro: 'true' })), /CEP não encontrado/);
});

test('trata HTTP, falha de rede e respostas incompletas sem mostrar dados falsos', async () => {
  for (const buscar of [
    async () => ({ ok: false }),
    async () => { throw new TypeError('Failed to fetch'); },
    resposta({}), resposta(null), resposta({ ...dadosApi, cep: '20040-002' }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError('JSON inválido'); } }),
  ]) {
    await assert.rejects(consultarCep('01001000', buscar), /Não foi possível consultar/);
  }
});

test('informa o limite de tempo da consulta', async () => {
  await assert.rejects(consultarCep('01001000', async () => {
    throw new DOMException('Abortado', 'AbortError');
  }), /demorou mais/);
});

test('permite CEP geral sem rua ou bairro e sem nome completo do estado', async () => {
  const endereco = await consultarCep('01001000', resposta({ ...dadosApi, logradouro: '', bairro: '', estado: undefined }));
  assert.equal(endereco.estado, 'SP');
  assert.equal(textoDoEndereco(endereco), 'São Paulo - SP, CEP 01001-000');
});

test('histórico mantém os 5 mais recentes sem duplicar uma nova consulta', () => {
  let historico = [];
  for (let i = 0; i < 7; i++) {
    historico = adicionarAoHistorico(historico, { cep: `01001-00${i}`, cidade: 'São Paulo', uf: 'SP' });
  }
  assert.equal(historico.length, 5);
  historico = adicionarAoHistorico(historico, { cep: '01001-004', cidade: 'São Paulo', uf: 'SP' });
  assert.equal(historico[0].cep, '01001-004');
  assert.equal(historico.filter(item => item.cep === '01001-004').length, 1);
});

test('lê o histórico do localStorage e descarta entradas inválidas ou repetidas', () => {
  const valido = { cep: '01001-000', cidade: 'São Paulo', uf: 'SP' };
  assert.deepEqual(lerHistorico(armazenamento(JSON.stringify([valido, {}, null, valido, { ...valido, cep: '123' }]))), [valido]);
  assert.deepEqual(lerHistorico(armazenamento(null)), []);
});

test('histórico corrompido ou bloqueado pode ser tratado pela interface', () => {
  assert.throws(() => lerHistorico(armazenamento('{quebrado')));
  assert.throws(() => lerHistorico(armazenamento('{}')));
  assert.throws(() => lerHistorico({ getItem() { throw new Error('Bloqueado'); } }), /Bloqueado/);
});
