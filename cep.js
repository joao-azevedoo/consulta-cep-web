export const CHAVE_HISTORICO = 'consulta-cep-web.historico';
export const LIMITE_HISTORICO = 5;

export function normalizarCep(valor) {
  const texto = String(valor).trim();
  if (!/^\d{5}-?\d{3}$/.test(texto)) {
    throw new Error('Digite um CEP com 8 números. Exemplo: 01001-000.');
  }
  return texto.replace('-', '');
}

export function formatarCep(cep) {
  const numeros = normalizarCep(cep);
  return `${numeros.slice(0, 5)}-${numeros.slice(5)}`;
}

async function buscarEstados(buscar) {
  try {
    const resposta = await buscar('https://servicodados.ibge.gov.br/api/v1/localidades/estados', {
      cache: 'force-cache',
      signal: AbortSignal.timeout(1500),
    });
    if (!resposta.ok) return [];
    const estados = await resposta.json();
    return Array.isArray(estados) ? estados : [];
  } catch {
    // O endereço do ViaCEP continua disponível se o catálogo de estados falhar.
    return [];
  }
}

export async function consultarCep(valor, buscar = globalThis.fetch) {
  const cep = normalizarCep(valor);
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 10000);

  try {
    const [resposta, estados] = await Promise.all([
      buscar(`https://viacep.com.br/ws/${cep}/json/`, { signal: controle.signal }),
      buscarEstados(buscar),
    ]);
    if (!resposta.ok) throw new Error('SERVICO_INDISPONIVEL');

    const dados = await resposta.json();
    if (dados?.erro === true || dados?.erro === 'true') {
      throw new Error('CEP_NAO_ENCONTRADO');
    }
    if (!dados || typeof dados.localidade !== 'string' || !dados.localidade.trim()
        || typeof dados.uf !== 'string' || !/^[A-Z]{2}$/.test(dados.uf)
        || normalizarCep(dados.cep ?? '') !== cep) {
      throw new Error('RESPOSTA_INVALIDA');
    }

    const nomeViaCep = typeof dados.estado === 'string' ? dados.estado.trim() : '';
    const estadoIbge = estados.find(item => item?.sigla === dados.uf && typeof item.nome === 'string');
    return {
      cep: formatarCep(cep),
      rua: typeof dados.logradouro === 'string' ? dados.logradouro.trim() : '',
      bairro: typeof dados.bairro === 'string' ? dados.bairro.trim() : '',
      cidade: dados.localidade.trim(),
      uf: dados.uf,
      estado: estadoIbge?.nome.trim() || nomeViaCep || dados.uf,
    };
  } catch (erro) {
    if (erro.message === 'CEP_NAO_ENCONTRADO') {
      throw new Error('CEP não encontrado. Confira os números e tente novamente.');
    }
    if (erro.name === 'AbortError') {
      throw new Error('A consulta demorou mais que o esperado. Tente novamente.');
    }
    throw new Error('Não foi possível consultar o CEP. Verifique sua conexão e tente novamente.');
  } finally {
    clearTimeout(limite);
  }
}

export function lerHistorico(armazenamento) {
  const dados = JSON.parse(armazenamento.getItem(CHAVE_HISTORICO) ?? '[]');
  if (!Array.isArray(dados)) throw new Error('Histórico inválido.');

  const vistos = new Set();
  return dados.filter(item => {
    if (!item || typeof item.cep !== 'string' || !/^\d{5}-\d{3}$/.test(item.cep)
        || typeof item.cidade !== 'string' || !item.cidade.trim()
        || typeof item.uf !== 'string' || !/^[A-Z]{2}$/.test(item.uf)
        || vistos.has(item.cep)) return false;
    vistos.add(item.cep);
    return true;
  }).slice(0, LIMITE_HISTORICO).map(({ cep, cidade, uf }) => ({ cep, cidade, uf }));
}

export function adicionarAoHistorico(historico, endereco) {
  const registro = { cep: endereco.cep, cidade: endereco.cidade, uf: endereco.uf };
  return [registro, ...historico.filter(item => item.cep !== endereco.cep)].slice(0, LIMITE_HISTORICO);
}

export function textoDoEndereco(endereco) {
  return [endereco.rua, endereco.bairro, `${endereco.cidade} - ${endereco.uf}`, `CEP ${endereco.cep}`]
    .filter(Boolean).join(', ');
}
