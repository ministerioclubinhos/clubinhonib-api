import { MANUAL_WORK_LAYOUT as L } from '../constants/manual-work-layout.constants';
import { MANUAL_WORK_FRAMINGS } from '../constants/manual-work-scene.constants';
import { sharp } from './sharp.utils';
/** Mandatory print style is appended after the proposed composition to override colored drafts. */
export function buildManualWorkImagePrompt(
  composition: string,
  /** Picks the framing: a different draw each time the image is redrawn. */
  variation = 0,
): string {
  const framing =
    MANUAL_WORK_FRAMINGS[
      Math.abs(Math.floor(variation)) % MANUAL_WORK_FRAMINGS.length
    ];
  return `${composition}\n\nENQUADRAMENTO DESTA VERSÃO: ${framing}.\n\nREGRA OBRIGATÓRIA DO TRABALHO MANUAL PARA PINTAR:
Gere uma única imagem infantil de contornos pretos sobre fundo branco puro. Somente desenho de linha em preto e branco, com traços grossos, limpos e contínuos, formas grandes e áreas internas brancas amplas para a criança pintar.
Não use cores, tons de cinza, sombras, degradês, hachuras, texturas ou preenchimentos sólidos. Roupas, pele, cabelos, objetos e cenário devem permanecer sem pintura, delimitados por contornos; não produza uma ilustração já colorida.
Use somente a cena ou os elementos da composição relacionados à lição; ignore qualquer pedido de paleta, cor ou pintura pronta que apareça na descrição anterior.
Sem letras, título, versículo, referência, cabeçalho, marca ou logotipo dentro da imagem. Preserve margens brancas seguras e composição horizontal legível para impressão em meia folha A4.
UMA ÚNICA CENA, como nas folhas feitas à mão: os personagens da história em ação no momento principal da lição, com o cenário completo ao redor (chão, plantas, casas, água, céu com nuvens, animais ou objetos da passagem). Nunca divida a imagem em quadros, painéis ou sequência de cenas e não desenhe moldura. Figuras grandes, rostos amigáveis de traço infantil e roupas da época bíblica.
Formato paisagem bem largo, com a cena ocupando a imagem inteira de uma lateral à outra, sem grandes vazios. Deixe uma faixa de céu acima das cabeças e uma faixa de chão abaixo dos pés: nenhuma cabeça, rosto ou objeto importante encosta nas bordas superior e inferior, porque elas podem ser aparadas na impressão.
Produza apenas uma arte; as duas cópias idênticas na folha são montadas pelo exportador.`;
}

/**
 * Makes the artwork span the full width of its frame, as in the handmade
 * sheets: the white paper around the drawing is trimmed and, when the drawing
 * is still taller than the frame, a strip of sky and, mostly, of ground is cut
 * (never more than `maximumCropShare` of the height).
 */
export async function fitManualWorkArt(
  image: Buffer,
  boxHeight: number,
): Promise<Buffer> {
  try {
    const trimmed = await sharp(image)
      .trim({ background: '#ffffff', threshold: L.trimThreshold })
      .png()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = trimmed.info;
    if (!width || !height) return image;
    const target = Math.round((width * boxHeight) / L.imageMaximumWidth);
    const cropped = Math.max(
      target,
      Math.round(height * (1 - L.maximumCropShare)),
    );
    if (cropped >= height) return trimmed.data;
    return await sharp(trimmed.data)
      .extract({
        left: 0,
        top: Math.floor((height - cropped) * L.cropTopShare),
        width,
        height: cropped,
      })
      .png()
      .toBuffer();
  } catch {
    // Not a readable image: it is printed as generated.
    return image;
  }
}
