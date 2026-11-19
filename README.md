# Consulta CEP

Site de João Azevedo para consultar endereços pelo CEP, feito com HTML, CSS e JavaScript puro.

**[Acessar o site](https://joao-azevedoo.github.io/consulta-cep-web/)**

- Exibe rua, bairro, cidade e estado usando a API ViaCEP.
- Carrega em paralelo o endereço do ViaCEP e o catálogo de estados do IBGE com `Promise.all`. Se o catálogo estiver indisponível, usa o estado informado pelo ViaCEP.
- Valida o CEP e mostra os resultados sem recarregar a página.
- Salva as últimas 5 consultas no navegador com localStorage.
- Permite copiar o endereço com a Clipboard API.

Para executar localmente, sirva esta pasta com um servidor estático, como a extensão Live Server do VS Code. Não é necessário instalar dependências ou compilar o site.

Os testes podem ser executados com `npm test` (Node.js 20 ou superior).
