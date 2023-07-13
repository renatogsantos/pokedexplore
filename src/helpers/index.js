export function convertWeightToKilograms(weight) {
  const kilograms = weight / 10;
  return kilograms;
}

export function convertHeightToMeters(height) {
  const meters = height / 10;
  return meters;
}

export function extrairPrimeiraPalavra(string, separador) {
  const palavras = string.split(separador);
  const primeiraPalavra = palavras[0].toUpperCase();
  return primeiraPalavra;
}


export function gerarNumeroAleatorio(num) {
  return Math.floor(Math.random() * num) + 1;
}


export function scrollTo(id) {
  let div = document.getElementById(id);
  if (div) {
    setTimeout(() => {
      div.scrollIntoView();
    }, 500);
  }
}