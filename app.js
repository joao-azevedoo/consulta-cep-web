import {
  CHAVE_HISTORICO, normalizarCep, consultarCep, lerHistorico,
  adicionarAoHistorico, textoDoEndereco,
} from './cep.js';

const elemento = id => document.getElementById(id);
const formulario = elemento('cep-form');
const campoCep = elemento('cep');
const botaoConsulta = elemento('search-button');
const feedback = elemento('feedback');
const painelResultado = elemento('result-panel');
const botaoCopiar = elemento('copy-button');
const listaHistorico = elemento('history-list');
const botaoLimpar = elemento('clear-history');
let enderecoAtual = null;
let consultando = false;
let historico = [];

function avisarSobreArmazenamento() {
  elemento('storage-feedback').textContent = 'Não foi possível acessar o histórico salvo. As consultas continuam funcionando, mas o histórico desta sessão pode não ser mantido ao fechar a página.';
}

try {
  historico = lerHistorico(window.localStorage);
} catch {
  avisarSobreArmazenamento();
}

function mostrarHistorico() {
  listaHistorico.replaceChildren();
  for (const item of historico) {
    const linha = document.createElement('li');
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.disabled = consultando;
    botao.setAttribute('aria-label', `Consultar novamente o CEP ${item.cep}, ${item.cidade} - ${item.uf}`);
    const cep = document.createElement('span');
    cep.className = 'history-cep';
    cep.textContent = item.cep;
    const cidade = document.createElement('span');
    cidade.className = 'history-city';
    cidade.textContent = `${item.cidade} · ${item.uf}`;
    botao.append(cep, cidade);
    botao.addEventListener('click', () => {
      campoCep.value = item.cep;
      formulario.requestSubmit();
    });
    linha.append(botao);
    listaHistorico.append(linha);
  }
  elemento('history-empty').hidden = historico.length > 0;
  botaoLimpar.hidden = historico.length === 0;
  botaoLimpar.disabled = consultando;
}

function salvarHistorico() {
  try {
    window.localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico));
    elemento('storage-feedback').textContent = '';
  } catch {
    avisarSobreArmazenamento();
  }
  mostrarHistorico();
}

function mostrarCarregamento(ativo) {
  consultando = ativo;
  botaoConsulta.disabled = ativo;
  campoCep.disabled = ativo;
  painelResultado.setAttribute('aria-busy', String(ativo));
  elemento('search-label').textContent = ativo ? 'Consultando…' : 'Consultar CEP';
  mostrarHistorico();
}

function limparResultado() {
  enderecoAtual = null;
  elemento('address-result').hidden = true;
  elemento('empty-state').hidden = false;
  elemento('copy-feedback').textContent = '';
  elemento('manual-copy').hidden = true;
}

function mostrarEndereco(endereco) {
  enderecoAtual = endereco;
  elemento('result-cep').textContent = endereco.cep;
  elemento('result-street').textContent = endereco.rua || 'Não informado para este CEP';
  elemento('result-neighborhood').textContent = endereco.bairro || 'Não informado para este CEP';
  elemento('result-city').textContent = endereco.cidade;
  elemento('result-state').textContent = endereco.estado === endereco.uf ? endereco.uf : `${endereco.estado} (${endereco.uf})`;
  elemento('empty-state').hidden = true;
  elemento('address-result').hidden = false;
}

formulario.addEventListener('submit', async evento => {
  evento.preventDefault();
  if (consultando) return;
  feedback.textContent = '';
  feedback.dataset.kind = '';
  campoCep.removeAttribute('aria-invalid');
  limparResultado();

  let cep;
  try {
    cep = normalizarCep(campoCep.value);
  } catch (erro) {
    feedback.textContent = erro.message;
    feedback.dataset.kind = 'error';
    campoCep.setAttribute('aria-invalid', 'true');
    campoCep.focus();
    return;
  }

  mostrarCarregamento(true);
  feedback.textContent = 'Buscando o endereço…';
  try {
    const endereco = await consultarCep(cep);
    campoCep.value = endereco.cep;
    mostrarEndereco(endereco);
    historico = adicionarAoHistorico(historico, endereco);
    salvarHistorico();
    feedback.textContent = 'Consulta concluída. Confira o endereço ao lado ou abaixo.';
  } catch (erro) {
    feedback.textContent = erro.message;
    feedback.dataset.kind = 'error';
  } finally {
    mostrarCarregamento(false);
  }
});

campoCep.addEventListener('input', () => {
  campoCep.removeAttribute('aria-invalid');
  feedback.textContent = '';
});

botaoCopiar.addEventListener('click', async () => {
  if (!enderecoAtual) return;
  const endereco = enderecoAtual;
  const texto = textoDoEndereco(endereco);
  elemento('manual-copy').hidden = true;
  elemento('copy-feedback').textContent = '';
  try {
    await navigator.clipboard.writeText(texto);
    if (enderecoAtual === endereco) elemento('copy-feedback').textContent = 'Endereço copiado!';
  } catch {
    if (enderecoAtual !== endereco) return;
    elemento('copy-feedback').textContent = 'A cópia automática não está disponível neste navegador.';
    elemento('manual-copy').hidden = false;
    elemento('copy-text').value = texto;
    elemento('copy-text').focus();
    elemento('copy-text').select();
  }
});

botaoLimpar.addEventListener('click', () => {
  historico = [];
  salvarHistorico();
});

mostrarHistorico();
