export function convertWeightToKilograms(weight) {
  const kilograms = weight / 10; // 1 hectograma = 0,1 quilograma
  return kilograms;
}

// Função para converter a altura de decímetros (dm) para metros (m)
export function convertHeightToMeters(height) {
  const meters = height / 10; // 1 decímetro = 0,1 metro
  return meters;
}