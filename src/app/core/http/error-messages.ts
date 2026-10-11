/**
 * User-facing messages (pt-BR) for the stable error codes the API returns in the
 * problem details `title`. See the "Errors" section of the API guide.
 */
export const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  validation_error: 'Revise os campos informados.',
  network_error: 'Sem conexão com o servidor. Verifique sua internet e tente de novo.',
  server_error: 'O servidor não conseguiu responder agora. Tente novamente em instantes.',
  unauthorized: 'Sua sessão não é mais válida. Entre novamente.',
  forbidden: 'Você não tem permissão para esta ação.',
  not_found: 'Não encontramos o que você procurou.',
  conflict: 'Essa ação conflita com o estado atual. Atualize e tente de novo.',

  'privacy.account_not_found': 'Conta não encontrada ou já excluída.',
  'privacy.admin_not_allowed': 'Contas de administrador só podem ser removidas por outro administrador.',
  'privacy.active_deliveries': 'Conclua ou cancele as entregas em andamento antes de excluir a conta.',
  'auth.invalid_credentials': 'E-mail ou senha incorretos.',
  'auth.invalid_refresh_token': 'Sua sessão expirou. Entre novamente.',
  'auth.user_inactive': 'Esta conta está desativada. Fale com o suporte.',
  'auth.email_in_use': 'Este e-mail já tem uma conta. Entre com ela.',

  'driver.profile_locked': 'O cadastro está em análise ou aprovado e não pode ser editado.',
  'driver.profile_not_found': 'Você ainda não criou o cadastro de motorista.',
  'driver.tax_id_in_use': 'Outra conta já usa este CPF/CNPJ.',
  'driver.cnh_in_use': 'Outra conta já usa esta CNH.',
  'driver.plate_in_use': 'Outra conta já cadastrou esta placa.',
  'driver.submission_incomplete': 'Faltam itens para enviar: termos, veículo ou documento.',

  'admin.not_pending_review': 'Este motorista não está mais aguardando análise.',

  'freight.terms_not_accepted': 'Aceite os termos ativos antes de publicar um frete.',
  'freight.not_found': 'Frete não encontrado.',
  'freight.not_open': 'Este frete já foi fechado, cancelado ou expirou.',
  'freight.window_closed': 'A janela de propostas deste frete já terminou.',

  'proposal.not_found': 'Proposta não encontrada.',
  'proposal.not_pending': 'Esta proposta já foi decidida.',
  'proposal.already_submitted': 'Você já tem uma proposta pendente neste frete.',
  'proposal.driver_not_approved': 'Só motoristas aprovados podem enviar propostas.',
  'proposal.driver_unavailable': 'O motorista está indisponível. Escolha outra proposta.',
  'proposal.vehicle_unavailable': 'O veículo está indisponível. Escolha outra proposta.',
  'proposal.driver_busy': 'O motorista já tem outra corrida nesse horário. Escolha outra proposta.',
  'proposal.vehicle_not_eligible': 'O veículo não é do tipo pedido ou não comporta o peso.',

  'delivery.not_found': 'Entrega não encontrada.',
  'delivery.stop_out_of_order': 'As paradas seguem a ordem da rota. Conclua primeiro a parada indicada.',
  'delivery.invalid_proof': 'O comprovante não é válido: use um arquivo de comprovante de entrega seu.',
  'delivery.invalid_status': 'Essa ação não vale para o status atual da entrega. Atualizamos a tela.',
  'payment.already_confirmed': 'O pagamento desta entrega já foi confirmado.',
  'payment.not_delivered': 'O pagamento só pode ser confirmado depois que a entrega for concluída.',
  'request.duplicate': 'Recebemos o mesmo pedido duas vezes. Atualizamos a tela, confira o resultado.',
  'route.missing_coordinates': 'Alguns endereços ainda não têm posição no mapa. Edite-os e use "Localizar no mapa".',
};

export const GENERIC_ERROR_MESSAGE = 'Algo deu errado. Tente novamente.';
