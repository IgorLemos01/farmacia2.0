// ============================================================
//  VALIDAÇÕES DE CADASTRO — mesmas regras do backend (app/utils.py)
//  Usadas pelos formulários (aviso antes de enviar) e pelo modo demonstração.
//  Cada função devolve o valor normalizado, `null` para vazio, ou lança Error.
// ============================================================

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const SEXOS = { M: 'Masculino', F: 'Feminino', Outro: 'Outro' };

export const soDigitos = valor => String(valor ?? '').replace(/\D/g, '');
const vazio = valor => valor === null || valor === undefined || String(valor).trim() === '';

export function cpfValido(digitos) {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(digitos[i]) * (tamanho + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(digitos[tamanho])) return false;
  }
  return true;
}

export function normalizarCpf(valor) {
  if (vazio(valor)) return null;
  const d = soDigitos(valor);
  if (!cpfValido(d)) throw new Error('CPF inválido. Confira os números ou deixe o campo em branco.');
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function normalizarTelefone(valor, { obrigatorio = true } = {}) {
  if (vazio(valor)) {
    if (obrigatorio) throw new Error("O campo 'WhatsApp / Telefone' é obrigatório.");
    return null;
  }
  let d = soDigitos(valor);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) throw new Error('Telefone inválido. Informe o DDD e o número, ex.: (79) 99999-9999.');
  return d.length === 11
    ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

export function normalizarCep(valor) {
  if (vazio(valor)) return null;
  const d = soDigitos(valor);
  if (d.length !== 8) throw new Error('CEP inválido. Use 8 números, ex.: 49000-000.');
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function normalizarUf(valor) {
  if (vazio(valor)) return null;
  const uf = String(valor).trim().toUpperCase();
  if (!UFS.includes(uf)) throw new Error('Estado (UF) inválido. Use a sigla, ex.: SE.');
  return uf;
}

export function normalizarEmail(valor) {
  if (vazio(valor)) return null;
  const email = String(valor).trim().toLowerCase();
  if (email.length > 150 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('E-mail inválido.');
  return email;
}

export function normalizarNascimento(valor, hoje = new Date()) {
  if (vazio(valor)) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor));
  if (!m) throw new Error('Data de nascimento inválida. Use o formato AAAA-MM-DD.');
  const dois = n => String(n).padStart(2, '0');
  const hojeIso = `${hoje.getFullYear()}-${dois(hoje.getMonth() + 1)}-${dois(hoje.getDate())}`;
  if (valor > hojeIso) throw new Error('A data de nascimento não pode ser no futuro.');
  if (Number(m[1]) < 1900) throw new Error('Data de nascimento inválida.');
  return valor;
}

function texto(valor, maximo, rotulo) {
  if (vazio(valor)) return null;
  const t = String(valor).trim();
  if (t.length > maximo) throw new Error(`${rotulo} deve ter no máximo ${maximo} caracteres.`);
  return t;
}

function nome(valor) {
  const t = String(valor ?? '').replace(/\s+/g, ' ').trim();
  if (!t) throw new Error("O campo 'Nome completo' é obrigatório.");
  if (t.length < 2) throw new Error('Informe o nome do cliente.');
  if (t.length > 150) throw new Error('O nome deve ter no máximo 150 caracteres.');
  return t;
}

function sexo(valor) {
  if (vazio(valor)) return null;
  if (!(valor in SEXOS)) throw new Error("Sexo inválido. Utilize 'M', 'F' ou 'Outro'.");
  return valor;
}

/** Normalizador de cada campo do cliente. */
export const CAMPOS_CLIENTE = {
  nome,
  telefone: v => normalizarTelefone(v),
  cpf: normalizarCpf,
  rg: v => texto(v, 20, 'RG'),
  data_nascimento: v => normalizarNascimento(v),
  sexo,
  email: normalizarEmail,
  cep: normalizarCep,
  endereco: v => texto(v, 300, 'Rua / Logradouro'),
  numero: v => texto(v, 20, 'Número'),
  complemento: v => texto(v, 100, 'Complemento'),
  bairro: v => texto(v, 100, 'Bairro'),
  cidade: v => texto(v, 100, 'Cidade'),
  estado: normalizarUf,
  alergia: v => texto(v, 5000, 'Alergias'),
  observacoes: v => texto(v, 5000, 'Observações'),
};

/** Campos que completam o cadastro (mesma lista do backend). */
export const CAMPOS_COMPLEMENTARES = {
  cpf: 'CPF', rg: 'RG', data_nascimento: 'Data de nascimento', sexo: 'Sexo', email: 'E-mail',
  cep: 'CEP', endereco: 'Rua / Logradouro', numero: 'Número', bairro: 'Bairro', cidade: 'Cidade', estado: 'Estado (UF)',
};

/** Valida só os campos presentes em `dados`. */
export function validarCliente(dados, campos = Object.keys(dados).filter(c => c in CAMPOS_CLIENTE)) {
  return Object.fromEntries(campos.map(c => [c, CAMPOS_CLIENTE[c](dados[c])]));
}

export function camposPendentes(cliente) {
  return Object.entries(CAMPOS_COMPLEMENTARES).filter(([c]) => !cliente?.[c]).map(([, rotulo]) => rotulo);
}

export function enderecoCompleto(c) {
  if (!c) return '';
  let rua = [c.endereco, c.numero].filter(Boolean).join(', ');
  if (rua && c.complemento) rua += ` - ${c.complemento}`;
  const cidadeUf = [c.cidade, c.estado].filter(Boolean).join('/');
  const partes = [rua, c.bairro, cidadeUf].filter(Boolean);
  if (c.cep) partes.push(`CEP ${c.cep}`);
  return partes.join(' - ');
}

/** Acrescenta os campos calculados que a API devolve (cadastro completo, pendências, endereço). */
export function completarCliente(c) {
  const pendentes = camposPendentes(c);
  return { ...c, campos_pendentes: pendentes, cadastro_completo: !pendentes.length, endereco_completo: enderecoCompleto(c) };
}

// ── Máscaras de digitação (só aparência; a validação acima é que manda) ──
export function mascaraTelefone(valor) {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function mascaraCpf(valor) {
  const d = soDigitos(valor).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function mascaraCep(valor) {
  const d = soDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Liga uma máscara a um campo: formata enquanto digita, sem atrapalhar quem cola o número. */
export function aplicarMascara(input, mascara) {
  input.addEventListener('input', () => {
    const fim = input.selectionStart === input.value.length;
    input.value = mascara(input.value);
    if (fim) input.setSelectionRange?.(input.value.length, input.value.length);
  });
}
