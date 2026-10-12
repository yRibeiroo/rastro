"""Extrai as cores dominantes de Rastro.png e compara com o brand board.

Uso (na raiz do projeto):  python -E -P documentos/design/extrair-paleta.py
(-E -P isola como o -I, mas mantém o site-packages do usuário, onde o Pillow foi instalado com --user.)
Saída: documentos/design/paleta-extraida.json
Requer Pillow (python -m pip install --user pillow).
"""

import json
from pathlib import Path

from PIL import Image

PASTA = Path(__file__).resolve().parent
IMAGEM = PASTA / "Rastro.png"
SAIDA = PASTA / "paleta-extraida.json"

# Cores declaradas no brand board (texto da própria imagem).
DECLARADAS = {
    "verde_principal": "#00D1A0",
    "verde_secundario": "#4EE6B7",
    "grafite": "#0F172A",
    "cinza_claro": "#E5E7EB",
}


def hex_de(rgb):
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def rgb_de(hexa):
    return tuple(int(hexa[i : i + 2], 16) for i in (1, 3, 5))


def distancia(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def saturacao(rgb):
    hi, lo = max(rgb), min(rgb)
    return 0 if hi == 0 else (hi - lo) / hi


# Centro dos 4 círculos de cor do brand board (coordenadas na arte 1254x1254).
AMOSTRAS = {
    "verde_principal": (80, 835),
    "verde_secundario": (195, 835),
    "grafite": (311, 835),
    "cinza_claro": (426, 835),
}


def dominantes(img, n):
    """Quantiza a imagem (median cut) e devolve [(rgb, fração)] ordenado."""
    q = img.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    paleta = q.getpalette()[: n * 3]
    contagem = sorted(q.getcolors(), reverse=True)
    total = sum(c for c, _ in contagem)
    return [(tuple(paleta[i * 3 : i * 3 + 3]), c / total) for c, i in contagem]


def main():
    img = Image.open(IMAGEM).convert("RGB")
    escala = img.width / 1254
    amostras = {
        nome: hex_de(img.getpixel((round(x * escala), round(y * escala)))) for nome, (x, y) in AMOSTRAS.items()
    }
    img.thumbnail((400, 400))  # rápido e suficiente para cores dominantes

    geral = dominantes(img, 16)

    # Só os pixels "de marca" (verdes saturados), para achar o verde real da logo.
    pixels = getattr(img, "get_flattened_data", img.getdata)()
    verdes = [p for p in pixels if p[1] > p[0] + 40 and p[1] >= p[2] and saturacao(p) > 0.5]
    tela_verde = Image.new("RGB", (len(verdes), 1))
    tela_verde.putdata(verdes)
    marca = dominantes(tela_verde, 6)

    comparacao = {}
    for nome, hexa in DECLARADAS.items():
        alvo = rgb_de(hexa)
        rgb, _ = min(((c, f) for c, f in geral + marca), key=lambda cf: distancia(cf[0], alvo))
        comparacao[nome] = {
            "declarada": hexa,
            "mais_proxima_extraida": hex_de(rgb),
            "distancia_rgb": round(distancia(rgb, alvo), 1),
            "pixel_do_circulo_no_board": amostras[nome],
        }

    resultado = {
        "fonte": IMAGEM.name,
        "dominantes": [{"hex": hex_de(c), "fracao": round(f, 4)} for c, f in geral],
        "verdes_da_marca": [{"hex": hex_de(c), "fracao": round(f, 4)} for c, f in marca],
        "comparacao_com_brand_board": comparacao,
    }
    SAIDA.write_text(json.dumps(resultado, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(resultado, indent=2, ensure_ascii=False))

    # Autoverificação mínima: a imagem tem que conter verde de marca e grafite.
    assert comparacao["verde_principal"]["distancia_rgb"] < 80, "verde principal não encontrado"
    assert comparacao["grafite"]["distancia_rgb"] < 40, "grafite não encontrado"


if __name__ == "__main__":
    main()
