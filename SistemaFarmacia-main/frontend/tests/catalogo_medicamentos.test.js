import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardar = (chave, lista) => localStorage.setItem('fc_demo_' + chave, JSON.stringify(lista));
const ler = chave => JSON.parse(localStorage.getItem('fc_demo_' + chave));
const campo = id => document.getElementById(id);
const enviar = id => campo(id).dispatchEvent(new Event('submit', { cancelable: true }));

const med = (id, descricao, rms, laboratorio, ativo = true) => ({ id, descricao, rms, laboratorio, ativo, criado_em: '2026-10-01T09:00:00', atualizado_em: '2026-10-01T09:00:00' });

async function montar() {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', '');
  const { renderCatalogoMedicamentos } = await import('../src/js/views/catalogo_medicamentos.js');
  document.body.innerHTML = '<div id="c"></div>';
  const container = document.getElementById('c');
  await renderCatalogoMedicamentos(container);
  return container;
}

async function escolherArquivo(conteudo) {
  const bytes = new TextEncoder().encode(conteudo);
  const input = campo('arquivoImportarMedicamentos');
  Object.defineProperty(input, 'files', { value: [{ name: 'med.csv', size: bytes.length, arrayBuffer: async () => bytes.buffer }], configurable: true });
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(campo('resumoImportarMedicamentos').textContent.trim()).not.toBe(''));
}

let alerta;
beforeEach(() => {
  localStorage.clear();
  alerta = vi.fn();
  vi.stubGlobal('alert', alerta);
  vi.stubGlobal('confirm', vi.fn(() => true));
  guardar('catalogo_medicamentos', [
    med(1, 'ALPRAZOLAM 0,25 MG 30 CPRS', '1023506630034', 'EMS INDUSTRIA FARMACEUTICA LTDA'),
    med(2, 'AMOXICILINA 500 MG', '1256801470025', 'PRATI,DONADUZZI &CIA LTDA'),
    med(3, 'ANTIGO 10 MG', '1', 'LAB X', false),
  ]);
});

describe('Catálogo de Medicamentos (tela do administrador)', () => {
  it('lista RMS, descrição e laboratório e esconde os desativados', async () => {
    const c = await montar();
    expect(c.textContent).toContain('2 medicamento(s) disponível(is)');
    expect(c.textContent).toContain('1023506630034');
    expect(c.textContent).toContain('EMS INDUSTRIA FARMACEUTICA LTDA');
    expect(c.querySelector('tr[data-busca*="antigo"]').hidden).toBe(true);
    campo('mostrarMedicamentosInativos').click();
    expect(c.querySelector('tr[data-busca*="antigo"]').hidden).toBe(false);
  });

  it('busca por nome, RMS e laboratório, ignorando acentos e maiúsculas', async () => {
    const c = await montar();
    const visiveis = () => [...c.querySelectorAll('tr[data-busca]')].filter(tr => !tr.hidden).map(tr => tr.querySelector('td').textContent);
    for (const [termo, esperado] of [['alprazol', 'ALPRAZOLAM 0,25 MG 30 CPRS'], ['1256801470025', 'AMOXICILINA 500 MG'], ['prati', 'AMOXICILINA 500 MG']]) {
      campo('buscaMedicamentos').value = termo;
      campo('buscaMedicamentos').dispatchEvent(new Event('input'));
      expect(visiveis(), termo).toEqual([esperado]);
    }
    campo('buscaMedicamentos').value = 'nada';
    campo('buscaMedicamentos').dispatchEvent(new Event('input'));
    expect(campo('semResultadoMedicamentos').hidden).toBe(false);
  });

  it('adiciona medicamento', async () => {
    const c = await montar();
    campo('btnNovoMedicamento').click();
    campo('med_descricao').value = '  CLONAZEPAM   2 MG ';
    campo('med_rms').value = '1111111111111';
    campo('med_laboratorio').value = 'LAB Y';
    enviar('formMedicamento');
    await vi.waitFor(() => expect(c.textContent).toContain('CLONAZEPAM 2 MG'));
    expect(ler('catalogo_medicamentos').find(m => m.descricao === 'CLONAZEPAM 2 MG')).toMatchObject({ rms: '1111111111111', laboratorio: 'LAB Y', ativo: true });
  });

  it('recusa o mesmo RMS + descrição e explica', async () => {
    await montar();
    campo('btnNovoMedicamento').click();
    campo('med_descricao').value = 'alprazolam 0,25 mg 30 cprs';
    campo('med_rms').value = '1023506630034';
    enviar('formMedicamento');
    await vi.waitFor(() => expect(alerta).toHaveBeenCalled());
    expect(alerta.mock.calls[0][0]).toContain('Já existe');
    expect(ler('catalogo_medicamentos')).toHaveLength(3);
  });

  it('edita o laboratório mantendo o mesmo registro', async () => {
    const c = await montar();
    c.querySelector('tr[data-busca*="amoxi"] [data-acao="editar"]').click();
    expect(campo('med_descricao').value).toBe('AMOXICILINA 500 MG');
    expect(campo('med_rms').value).toBe('1256801470025');
    campo('med_laboratorio').value = 'OUTRO LAB';
    enviar('formMedicamento');
    await vi.waitFor(() => expect(c.textContent).toContain('OUTRO LAB'));
    expect(ler('catalogo_medicamentos').find(m => m.id === 2).laboratorio).toBe('OUTRO LAB');
  });

  it('"remover" só desativa, e dá para reativar', async () => {
    const c = await montar();
    c.querySelector('tr[data-busca*="amoxi"] [data-acao="excluir"]').click();
    await vi.waitFor(() => expect(ler('catalogo_medicamentos').find(m => m.id === 2).ativo).toBe(false));
    expect(ler('catalogo_medicamentos')).toHaveLength(3);

    await vi.waitFor(() => expect(c.textContent).toContain('1 medicamento(s) disponível(is)'));
    campo('mostrarMedicamentosInativos').click();
    c.querySelector('tr[data-busca*="amoxi"] [data-acao="reativar"]').click();
    await vi.waitFor(() => expect(ler('catalogo_medicamentos').find(m => m.id === 2).ativo).toBe(true));
  });

  it('mostra os nomes como texto, sem executar HTML', async () => {
    guardar('catalogo_medicamentos', [med(1, '<img src=x onerror="window.__xss=1">', '"><script>1</script>', '<b>LAB</b>')]);
    const c = await montar();
    expect(c.querySelector('tbody img, tbody script, tbody b')).toBeNull();
    expect(c.textContent).toContain('<img src=x');
  });
});

describe('Importar CSV de medicamentos', () => {
  it('importa o arquivo mantendo os 13 dígitos do RMS e informa o resultado', async () => {
    const c = await montar();
    campo('btnImportarMedicamentos').click();
    await escolherArquivo('RMS;Descrição;Laboratório\n1677304970028;AMOX+CLAVULANATO 400MG/5 ML PÓ;LEGRAND PHARMA\n0023506630034;COM ZERO ESQUERDA;LAB Z\n1256801470025;AMOXICILINA 500 MG;LAB TROCADO\n1023506630034;ALPRAZOLAM 0,25 MG 30 CPRS;EMS INDUSTRIA FARMACEUTICA LTDA\n');

    expect(campo('resumoImportarMedicamentos').textContent).toContain('4 medicamento(s) prontos para importar');
    campo('btnConfirmarImportarMedicamentos').click();
    await vi.waitFor(() => expect(campo('resumoImportarMedicamentos').textContent).toContain('Importação concluída'));
    expect(campo('resumoImportarMedicamentos').textContent).toMatch(/2 novo\(s\) · 1 atualizado\(s\) · 1 já estavam iguais/);

    const salvos = ler('catalogo_medicamentos');
    expect(salvos.find(m => m.descricao === 'COM ZERO ESQUERDA').rms).toBe('0023506630034');   // zeros preservados
    expect(salvos.find(m => m.id === 2).laboratorio).toBe('LAB TROCADO');
    expect(salvos).toHaveLength(5);                                                            // nada apagado

    campo('btnCancelarImportarMedicamentos').click();
    await vi.waitFor(() => expect(c.textContent).toContain('AMOX+CLAVULANATO'));
  });

  it('avisa sobre o Excel e recusa RMS em notação científica, importando o resto', async () => {
    await montar();
    expect(campo('modalImportarMedicamentos').textContent).toContain('notação científica');
    campo('btnImportarMedicamentos').click();
    await escolherArquivo('RMS;Descrição;Laboratório\n1,02351E+12;ESTRAGADO;LAB\n999;BOM 10 MG;LAB\n');
    const resumo = campo('resumoImportarMedicamentos').textContent;
    expect(resumo).toContain('1 medicamento(s) prontos');
    expect(resumo).toContain('1 linha(s) com problema');
    expect(resumo).toContain('notação científica');
  });

  it('importa direto a planilha de estoque (colunas extras são ignoradas)', async () => {
    guardar('catalogo_medicamentos', []);
    await montar();
    campo('btnImportarMedicamentos').click();
    await escolherArquivo('RMS;Descrição;Lote;VALIDADE;Quantidade;Laboratório\n1023506630034;ALPRAZOLAM 0,25 MG 30 CPRS;4Q6312;19/02/2027;2;EMS LTDA\n1023508850041;AMITRIPTILINA 25 MG 30 CPR;5G1843;25/11/2027;1;EMS LTDA\n');
    campo('btnConfirmarImportarMedicamentos').click();
    await vi.waitFor(() => expect(ler('catalogo_medicamentos')).toHaveLength(2));
    expect(ler('catalogo_medicamentos')[0]).not.toHaveProperty('lote');
  });

  it('a lista fica nas abas de Configurações', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', '');
    const { renderConfiguracoes } = await import('../src/js/views/configuracoes.js');
    document.body.innerHTML = '<div id="c"></div>';
    const c = document.getElementById('c');
    await renderConfiguracoes(c);
    expect([...c.querySelectorAll('[data-aba]')].map(b => b.textContent)).toEqual(['Usuários', 'Catálogo de Exames', 'Catálogo de Medicamentos']);
    c.querySelector('[data-aba="medicamentos"]').click();
    await vi.waitFor(() => expect(c.textContent).toContain('ALPRAZOLAM 0,25 MG 30 CPRS'));
  });
});
