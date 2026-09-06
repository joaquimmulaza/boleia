/**
 * Dias da semana em formato ISO (1=Seg … 7=Dom).
 * Partilhado entre PublishRoute e PassengerDashboard para picker de dias.
 */
export const DIAS_SEMANA = [
  { valor: 1, label: 'Seg' },
  { valor: 2, label: 'Ter' },
  { valor: 3, label: 'Qua' },
  { valor: 4, label: 'Qui' },
  { valor: 5, label: 'Sex' },
  { valor: 6, label: 'Sáb' },
  { valor: 7, label: 'Dom' },
];

/** Dias úteis (Seg–Sex) por omissão. */
export const DIAS_UTEIS_DEFAULT = [1, 2, 3, 4, 5];
