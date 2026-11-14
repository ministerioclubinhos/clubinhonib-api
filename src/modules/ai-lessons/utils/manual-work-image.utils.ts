/** Mandatory print style is appended after the proposed composition to override colored drafts. */
export function buildManualWorkImagePrompt(composition: string): string {
  return `${composition}\n\nREGRA OBRIGATÓRIA DO TRABALHO MANUAL PARA PINTAR:
Gere uma única imagem infantil de contornos pretos sobre fundo branco puro. Somente desenho de linha em preto e branco, com traços grossos, limpos e contínuos, formas grandes e áreas internas brancas amplas para a criança pintar.
Não use cores, tons de cinza, sombras, degradês, hachuras, texturas ou preenchimentos sólidos. Roupas, pele, cabelos, objetos e cenário devem permanecer sem pintura, delimitados por contornos; não produza uma ilustração já colorida.
Use somente a cena ou os elementos da composição relacionados à lição; ignore qualquer pedido de paleta, cor ou pintura pronta que apareça na descrição anterior.
Sem letras, título, versículo, referência, cabeçalho, marca ou logotipo dentro da imagem. Preserve margens brancas seguras e composição horizontal legível para impressão em meia folha A4.
Produza apenas uma arte; as duas cópias idênticas na folha são montadas pelo exportador.`;
}
