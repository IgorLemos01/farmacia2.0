import { describe, expect, it } from 'vitest';
import { podeAcessar, primeiraRotaPermitida, rotulosDosModulos } from '../src/js/permissoes.js';
import { aplicarPermissoesNaTela } from '../src/js/menu.js';

const admin = { perfil: 'admin', modulos: [] };
const func = (...modulos) => ({ perfil: 'funcionario', modulos });

describe('podeAcessar', () => {
  it('administrador acessa todos os módulos e Configurações', () => {
    ['dashboard', 'clientes', 'manipulacoes', 'exames', 'receitas', 'configuracoes'].forEach(r => expect(podeAcessar(admin, r)).toBe(true));
  });

  it('funcionário acessa só os módulos marcados e nunca Configurações', () => {
    const u = func('clientes', 'exames');
    expect(podeAcessar(u, 'clientes')).toBe(true);
    expect(podeAcessar(u, 'exames')).toBe(true);
    expect(podeAcessar(u, 'receitas')).toBe(false);
    expect(podeAcessar(u, 'configuracoes')).toBe(false);
  });

  it('sem usuário, rota desconhecida ou módulos ausentes: nega', () => {
    expect(podeAcessar(null, 'clientes')).toBe(false);
    expect(podeAcessar(admin, 'inexistente')).toBe(false);
    expect(podeAcessar({ perfil: 'funcionario' }, 'clientes')).toBe(false);
  });
});

describe('primeiraRotaPermitida e rotulosDosModulos', () => {
  it('segue a ordem do menu', () => {
    expect(primeiraRotaPermitida(admin)).toBe('dashboard');
    expect(primeiraRotaPermitida(func('receitas', 'exames'))).toBe('exames');
    expect(primeiraRotaPermitida(func())).toBeNull();
    expect(rotulosDosModulos(func('receitas', 'clientes'))).toEqual(['Clientes', 'Receitas']);
  });
});

describe('aplicarPermissoesNaTela', () => {
  const montar = () => {
    document.body.innerHTML = `
      <div id="tituloMenu"></div>
      <a class="nav-item" data-route="dashboard"></a><a class="nav-item" data-route="clientes"></a>
      <a class="nav-item" data-route="exames"></a><a class="nav-item" data-route="configuracoes"></a>
      <div id="tituloGeral"></div><div class="search-pill-container"></div><button id="btnNovoAtendimento"></button>`;
  };
  const visivel = sel => document.querySelector(sel).style.display !== 'none';

  it('esconde o que o funcionário não pode usar', () => {
    montar();
    aplicarPermissoesNaTela(func('exames'));
    expect(visivel('[data-route="exames"]')).toBe(true);
    expect(visivel('[data-route="clientes"]')).toBe(false);
    expect(visivel('[data-route="configuracoes"]')).toBe(false);
    expect(visivel('#tituloGeral')).toBe(false);
    expect(visivel('.search-pill-container')).toBe(false); // sem Clientes, sem busca de pacientes
    expect(visivel('#btnNovoAtendimento')).toBe(false);
  });

  it('administrador vê tudo', () => {
    montar();
    aplicarPermissoesNaTela(admin);
    document.querySelectorAll('.nav-item, #tituloGeral, #btnNovoAtendimento').forEach(el => expect(el.style.display).not.toBe('none'));
  });
});
