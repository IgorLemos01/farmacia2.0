// ============================================================
//  AUTOCOMPLETE — campo de busca com lista de sugestões
//  (usado para escolher paciente e medicamento)
// ============================================================

/**
 * Liga uma lista de sugestões a um <input>.
 *
 * @param {object}   opcoes
 * @param {HTMLInputElement} opcoes.input    Campo de texto.
 * @param {(termo:string)=>Promise<any[]>|any[]} opcoes.buscar   Devolve os itens que combinam com o texto.
 * @param {(item:any)=>string} opcoes.rotulo   Texto principal de cada sugestão.
 * @param {(item:any)=>string} [opcoes.detalhe] Texto menor, abaixo do principal.
 * @param {(item:any)=>void}   opcoes.aoEscolher  Chamado ao escolher uma sugestão.
 * @param {number} [opcoes.minimo=0]  Quantidade mínima de letras para buscar.
 * @param {number} [opcoes.atraso=180] Espera (ms) após digitar, para não buscar a cada tecla.
 * @param {number} [opcoes.maximo=8]  Máximo de sugestões exibidas.
 *
 * Os textos entram na lista com `textContent`, nunca como HTML.
 */
export function criarAutocomplete({ input, buscar, rotulo, detalhe, aoEscolher, minimo = 0, atraso = 180, maximo = 8 }) {
  const caixa = input.parentElement;
  caixa.classList.add('campo-autocomplete');

  const lista = document.createElement('ul');
  lista.className = 'autocomplete-lista';
  lista.setAttribute('role', 'listbox');
  lista.hidden = true;
  caixa.appendChild(lista);

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');

  let itens = [];
  let ativo = -1;
  let temporizador = 0;
  let pedido = 0; // descarta respostas que chegam fora de ordem

  function fechar() {
    lista.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    ativo = -1;
  }

  function destacar(indice) {
    ativo = indice;
    [...lista.children].forEach((li, i) => li.classList.toggle('ativo', i === ativo));
  }

  function escolher(indice) {
    const item = itens[indice];
    if (item === undefined) return;
    fechar();
    aoEscolher(item);
  }

  function desenhar(resultado) {
    itens = resultado.slice(0, maximo);
    lista.replaceChildren();
    if (!itens.length) {
      const vazio = document.createElement('li');
      vazio.className = 'autocomplete-vazio';
      vazio.textContent = 'Nenhum resultado.';
      lista.appendChild(vazio);
    }
    itens.forEach((item, i) => {
      const li = document.createElement('li');
      li.className = 'autocomplete-item';
      li.setAttribute('role', 'option');

      const principal = document.createElement('span');
      principal.className = 'autocomplete-principal';
      principal.textContent = rotulo(item);
      li.appendChild(principal);

      const extra = detalhe ? detalhe(item) : '';
      if (extra) {
        const sub = document.createElement('span');
        sub.className = 'autocomplete-detalhe';
        sub.textContent = extra;
        li.appendChild(sub);
      }
      // mousedown (e não click): acontece antes de o campo perder o foco e fechar a lista
      li.addEventListener('mousedown', (ev) => { ev.preventDefault(); escolher(i); });
      lista.appendChild(li);
    });
    lista.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    destacar(itens.length ? 0 : -1);
  }

  async function pesquisar() {
    const termo = input.value.trim();
    if (termo.length < minimo) { fechar(); return; }
    const meu = ++pedido;
    try {
      const resultado = await buscar(termo);
      if (meu === pedido && document.activeElement === input) desenhar(resultado);
    } catch (_) {
      if (meu === pedido) fechar();
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(pesquisar, atraso);
  });
  input.addEventListener('focus', pesquisar);
  input.addEventListener('blur', () => { pedido++; clearTimeout(temporizador); setTimeout(fechar, 120); });
  input.addEventListener('keydown', (ev) => {
    if (lista.hidden) {
      if (ev.key === 'ArrowDown') pesquisar();
      return;
    }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); destacar(Math.min(ativo + 1, itens.length - 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); destacar(Math.max(ativo - 1, 0)); }
    else if (ev.key === 'Enter' && ativo >= 0) { ev.preventDefault(); escolher(ativo); }
    else if (ev.key === 'Escape') { ev.stopPropagation(); fechar(); }
  });

  return { fechar };
}
