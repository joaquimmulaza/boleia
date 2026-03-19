export const formatCurrency = (value) => {
  return Number(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${date.getDate().toString().padStart(2, '0')} de ${meses[date.getMonth()]}`;
};
