import { describe, expect, it } from 'vitest';
import { aplicarPermissoesNaTela } from '../src/js/menu.js';

function montarTopo() {
  document.body.innerHTML = `
    <div class="menu-novo">
      <button id="btnNovoAtendimento"></button>
      <div id="menuNovoAtendimento">
        <button data-novo="manipulacoes"></button><button data-novo="exames"></button>
        <button data-novo="receitas"></button><button data-novo="clientes"></button>
      </div>
    </div>`;
  return document;
}
const visiveis = () => [...document.querySelectorAll('[data-novo]')].filter(b => b.style.display !== 'none').map(b => b.dataset.novo);

describe('menu "Novo Atendimento"', () => {
  it('mostra só as opções das telas que o usuário pode usar', () => {
    aplicarPermissoesNaTela({ perfil: 'funcionario', modulos: ['exames', 'receitas'] }, montarTopo());
    expect(visiveis()).toEqual(['exames', 'receitas']);
    expect(document.querySelector('.menu-novo').style.display).not.toBe('none');
  });

  it('administrador vê todas', () => {
    aplicarPermissoesNaTela({ perfil: 'admin', modulos: [] }, montarTopo());
    expect(visiveis()).toEqual(['manipulacoes', 'exames', 'receitas', 'clientes']);
  });

  it('quem só tem o Dashboard não vê o botão', () => {
    aplicarPermissoesNaTela({ perfil: 'funcionario', modulos: ['dashboard'] }, montarTopo());
    expect(document.querySelector('.menu-novo').style.display).toBe('none');
  });
});
