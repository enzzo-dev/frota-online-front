/**
 * The API now writes its own validation messages in Portuguese. The stock texts of the validation library
 * (empty field, maximum length, e-mail format...) are still English, so they are translated here before they reach
 * the screen. Any other message is shown as the API sent it.
 */

/** Names the API uses for fields (FluentValidation spaces them, `FullName` becomes `Full Name`). */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  'address id': 'endereço',
  'address ids': 'endereços',
  amount: 'valor',
  'capacity kg': 'capacidade',
  ccv: 'código de segurança',
  'cargo description': 'descrição da carga',
  'cargo weight kg': 'peso da carga',
  city: 'cidade',
  'cnh category': 'categoria da CNH',
  'cnh number': 'número da CNH',
  complement: 'complemento',
  'content type': 'tipo do arquivo',
  'content url': 'endereço do documento',
  description: 'descrição',
  district: 'bairro',
  email: 'e-mail',
  'expiry month': 'mês de validade',
  'expiry year': 'ano de validade',
  'full name': 'nome completo',
  'holder name': 'nome do titular',
  items: 'itens',
  kind: 'tipo',
  label: 'nome do endereço',
  latitude: 'latitude',
  longitude: 'longitude',
  message: 'recado',
  method: 'forma de pagamento',
  model: 'modelo',
  note: 'observação',
  number: 'número',
  password: 'senha',
  'phone number': 'telefone',
  plan: 'plano',
  plate: 'placa',
  platform: 'plataforma',
  'postal code': 'CEP',
  price: 'preço',
  reason: 'motivo',
  reference: 'referência',
  'refresh token': 'sessão',
  'required vehicle type': 'tipo de veículo',
  'size bytes': 'tamanho do arquivo',
  state: 'estado',
  stops: 'paradas',
  'storage key': 'arquivo',
  street: 'rua',
  'tax id': 'CPF/CNPJ',
  title: 'título',
  type: 'tipo',
  version: 'versão',
  'wallet id': 'conta de recebimento',
  year: 'ano',
  'zip code': 'CEP',
};

function label(name: string): string {
  const key = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return FIELD_LABELS[key] ?? key;
}

type Rule = readonly [pattern: RegExp, build: (match: RegExpMatchArray) => string];

/** The stock FluentValidation texts. */
const PATTERNS: readonly Rule[] = [
  [/^'(.+)' must not be empty\.$/, (m) => `Preencha ${label(m[1])}.`],
  [
    /^The length of '(.+)' must be (\d+) characters or fewer\. You entered \d+ characters\.$/,
    (m) => `${cap(label(m[1]))} pode ter no máximo ${m[2]} caracteres.`,
  ],
  [
    /^The length of '(.+)' must be at least (\d+) characters\. You entered \d+ characters\.$/,
    (m) => `${cap(label(m[1]))} deve ter pelo menos ${m[2]} caracteres.`,
  ],
  [/^'(.+)' is not a valid email address\.$/, () => 'Informe um e-mail válido.'],
  [/^'(.+)' is not in the correct format\.$/, (m) => `Confira o formato de ${label(m[1])}.`],
  [/^'(.+)' has a range of values which does not include '.*'\.$/, (m) => `Escolha um valor válido para ${label(m[1])}.`],
  [
    /^'(.+)' must be between ([\d.,-]+) and ([\d.,-]+)\. You entered .*\.$/,
    (m) => `${cap(label(m[1]))} deve estar entre ${m[2]} e ${m[3]}.`,
  ],
  [/^'(.+)' must be greater than '(.+)'\.$/, (m) => `${cap(label(m[1]))} deve ser maior que ${m[2]}.`],
  [/^'(.+)' must be less than or equal to '(.+)'\.$/, (m) => `${cap(label(m[1]))} deve ser no máximo ${m[2]}.`],
  [/^'(.+)' must not be equal to '(.*)'\.$/, (m) => `Confira ${label(m[1])}: esse valor não é permitido.`],
  [/^'(.+)' must be equal to '(.*)'\.$/, (m) => `Confira ${label(m[1])}.`],
  [/^'(.+)' must not be more than .*digits in total.*$/, (m) => `Confira o número de casas decimais de ${label(m[1])}.`],
];

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The Portuguese text of a validation message from the API, or the original when it is not known. */
export function translateValidation(message: string): string {
  for (const [pattern, build] of PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      return build(match);
    }
  }
  return message;
}
