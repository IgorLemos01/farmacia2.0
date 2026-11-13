import { describe, expect, it } from 'vitest';
import {
  camposPendentes, completarCliente, cpfValido, enderecoCompleto, mascaraCep, mascaraCpf, mascaraTelefone,
  normalizarCep, normalizarCpf, normalizarEmail, normalizarNascimento, normalizarTelefone, normalizarUf, validarCliente,
} from '../src/js/validacao.js';

describe('CPF', () => {
  it('confere os dígitos verificadores', () => {
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('52998224724')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('123')).toBe(false);
  });
  it('formata e aceita vazio', () => {
    expect(normalizarCpf('52998224725')).toBe('529.982.247-25');
    expect(normalizarCpf(' 529.982.247-25 ')).toBe('529.982.247-25');
    expect(normalizarCpf('')).toBeNull();
    expect(normalizarCpf(null)).toBeNull();
    expect(() => normalizarCpf('123.456.789-00')).toThrow('CPF inválido');
  });
});

describe('telefone, CEP, UF, e-mail e nascimento', () => {
  it('telefone com DDD (fixo ou celular), aceitando +55', () => {
    expect(normalizarTelefone('79999998888')).toBe('(79) 99999-8888');
    expect(normalizarTelefone('+55 (79) 3211-4455')).toBe('(79) 3211-4455');
    expect(() => normalizarTelefone('')).toThrow('obrigatório');
    expect(() => normalizarTelefone('99998888')).toThrow('DDD');
    expect(normalizarTelefone('', { obrigatorio: false })).toBeNull();
  });
  it('CEP, UF e e-mail', () => {
    expect(normalizarCep('49000000')).toBe('49000-000');
    expect(() => normalizarCep('4900')).toThrow();
    expect(normalizarUf('se')).toBe('SE');
    expect(() => normalizarUf('XX')).toThrow();
    expect(normalizarEmail(' Ana@X.com ')).toBe('ana@x.com');
    expect(() => normalizarEmail('ana@')).toThrow();
  });
  it('nascimento não pode ser no futuro', () => {
    const hoje = new Date(2026, 10, 13);
    expect(normalizarNascimento('1990-01-01', hoje)).toBe('1990-01-01');
    expect(() => normalizarNascimento('2027-01-01', hoje)).toThrow('futuro');
    expect(normalizarNascimento('')).toBeNull();
  });
});

describe('cliente', () => {
  it('valida só os campos enviados', () => {
    expect(validarCliente({ nome: '  Ana   Maria ', telefone: '79999998888' })).toEqual({ nome: 'Ana Maria', telefone: '(79) 99999-8888' });
    expect(() => validarCliente({ nome: ' ' })).toThrow('Nome completo');
    expect(() => validarCliente({ sexo: 'X' })).toThrow('Sexo');
  });
  it('lista pendências e monta o endereço', () => {
    const c = { nome: 'Ana', telefone: '1', cpf: '529.982.247-25', endereco: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Aracaju', estado: 'SE' };
    expect(camposPendentes(c)).toEqual(['RG', 'Data de nascimento', 'Sexo', 'E-mail', 'CEP']);
    expect(enderecoCompleto(c)).toBe('Rua A, 10 - Centro - Aracaju/SE');
    expect(completarCliente(c).cadastro_completo).toBe(false);
  });
  it('máscaras de digitação', () => {
    expect(mascaraTelefone('7999998')).toBe('(79) 9999-8');
    expect(mascaraTelefone('79999998888')).toBe('(79) 99999-8888');
    expect(mascaraCpf('52998224725')).toBe('529.982.247-25');
    expect(mascaraCep('49000000')).toBe('49000-000');
  });
});
