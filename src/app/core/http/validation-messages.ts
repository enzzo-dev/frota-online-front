/**
 * The API writes its validation messages in English. The app is pt-BR only, so they are translated here before
 * they reach the screen. A message that is not known stays as the API sent it.
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

/** Messages the API sets itself (`WithMessage`), word for word. */
const EXACT: Readonly<Record<string, string>> = {
  'A freight needs at least one pickup and one delivery.': 'O frete precisa de pelo menos uma coleta e uma entrega.',
  'A route needs at least two addresses.': 'A rota precisa de pelo menos dois endereços.',
  'Amount can have at most two decimal places.': 'O valor pode ter no máximo duas casas decimais.',
  'CNH must have 11 digits.': 'A CNH deve ter 11 dígitos.',
  'CPF or CNPJ is invalid. Check the number and its verification digits.':
    'CPF ou CNPJ inválido. Confira o número e os dígitos verificadores.',
  'CPF or CNPJ is required for drivers.': 'Informe o CPF ou CNPJ do motorista.',
  'Content URL must be an absolute https URL.': 'O endereço do documento deve ser um link https completo.',
  'Drivers can only register DriverDocument, VehiclePhoto or DeliveryProof files here.':
    'O motorista só pode registrar documentos, fotos do veículo ou comprovantes de entrega.',
  'Drivers can only upload DriverDocument, VehiclePhoto or DeliveryProof files here.':
    'O motorista só pode enviar documentos, fotos do veículo ou comprovantes de entrega.',
  'Enter a valid CPF or CNPJ.': 'Informe um CPF ou CNPJ válido.',
  'Enter a valid card number.': 'Informe um número de cartão válido.',
  'Enter the expiry month (01 to 12).': 'Informe o mês de validade (01 a 12).',
  'Enter the expiry year with four digits.': 'Informe o ano de validade com quatro dígitos.',
  'Enter the postal code (CEP) with 8 digits.': 'Informe o CEP com 8 dígitos.',
  'Enter the security code (3 or 4 digits).': 'Informe o código de segurança (3 ou 4 dígitos).',
  'Every address id must be filled.': 'Todos os endereços da rota precisam ser escolhidos.',
  'Every stop must use a different address.': 'Cada parada deve usar um endereço diferente.',
  'Only Customer and Driver accounts can be self-registered.': 'Só é possível criar conta de cliente ou de motorista.',
  'Password must contain a digit.': 'A senha precisa ter um número.',
  'Password must contain a lowercase letter.': 'A senha precisa ter uma letra minúscula.',
  'Password must contain an uppercase letter.': 'A senha precisa ter uma letra maiúscula.',
  "Phone number must contain 10 to 15 digits, optionally starting with '+'.":
    "O telefone deve ter de 10 a 15 dígitos, podendo começar com '+'.",
  'Plate must follow the ABC1234 or ABC1D23 format.': 'A placa deve seguir o formato ABC1234 ou ABC1D23.',
  'Price can have at most two decimal places.': 'O preço pode ter no máximo duas casas decimais.',
  'Send either a saved card or the data of a new card.': 'Escolha um cartão salvo ou informe os dados de um cartão novo.',
  'Send latitude and longitude together.': 'Informe latitude e longitude juntas.',
  'Send the addresses of the route.': 'Informe os endereços da rota.',
  'Send the stops of the route.': 'Informe as paradas da rota.',
  'Set confirm to true to delete the account.': 'Confirme para excluir a conta.',
  'State must be a valid two-letter Brazilian state code.': 'Informe a sigla de um estado brasileiro (duas letras).',
  'The card holder data is required for a new card.': 'Informe os dados do titular do cartão novo.',
  'The first stop must be a pickup.': 'A primeira parada deve ser uma coleta.',
  'The last stop must be a delivery: it is the final delivery address.': 'A última parada deve ser uma entrega.',
  'The payout account id must be the wallet id of your payment account (a UUID).':
    'O identificador da conta de recebimento deve ser o walletId da sua conta de pagamento.',
  'ZIP code must have 8 digits.': 'O CEP deve ter 8 dígitos.',
  'A request body is required.': 'Faltaram dados no pedido.',
  'A non-empty request body is required.': 'Faltaram dados no pedido.',
};

type Rule = readonly [pattern: RegExp, build: (match: RegExpMatchArray) => string];

/** Messages with a number or a list inside, and the stock FluentValidation texts. */
const PATTERNS: readonly Rule[] = [
  [/^A freight can have at most (\d+) stops\.$/, (m) => `O frete pode ter no máximo ${m[1]} paradas.`],
  [/^A route can have at most (\d+) addresses\.$/, (m) => `A rota pode ter no máximo ${m[1]} endereços.`],
  [/^A stop can have at most (\d+) items\.$/, (m) => `Cada parada pode ter no máximo ${m[1]} itens.`],
  [/^CNH category must be one of: (.+)\.$/, (m) => `A categoria da CNH deve ser uma destas: ${m[1]}.`],
  [/^Content type must be one of: (.+)\.$/, (m) => `O tipo do arquivo deve ser um destes: ${m[1]}.`],
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
  // ASP.NET model binding.
  [/^The (.+) field is required\.$/, (m) => `Preencha ${label(m[1])}.`],
  [/^The JSON value could not be converted to .*$/, () => 'Um dos valores enviados não é válido.'],
  [/^'.*' is not a valid value.*$/, () => 'Um dos valores enviados não é válido.'],
];

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The Portuguese text of a validation message from the API, or the original when it is not known. */
export function translateValidation(message: string): string {
  const exact = EXACT[message];
  if (exact) {
    return exact;
  }
  for (const [pattern, build] of PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      return build(match);
    }
  }
  return message;
}

/** The server text of `route.missing_coordinates`, which lists the addresses without a map position. */
export function translateMissingCoordinates(detail: string): string {
  const match = detail.match(/^These addresses have no map position yet: (.+)\. Pick them on the map and save again\.$/);
  return match
    ? `Estes endereços ainda não têm posição no mapa: ${match[1]}. Escolha a posição no mapa e salve de novo.`
    : 'Alguns endereços ainda não têm posição no mapa. Edite-os e use "Localizar no mapa".';
}
