"""Vigie — détection d'arnaques par règles (sans IA, sans Internet).

Chaque règle ajoute des points et une explication en français simple.
Le verdict vient UNIQUEMENT de ces règles : l'IA locale explique, elle ne décide pas.

Pixel's ASBL — Boussu — licence GPL-3.0
"""
import re
import unicodedata
from urllib.parse import urlparse

SEUIL_ROUGE = 5   # à partir de 5 points : arnaque probable
SEUIL_ORANGE = 2  # de 2 à 4 points : prudence

# Organisations souvent imitées en Belgique -> domaines officiels connus.
# À tenir à jour par l'ASBL (liste non exhaustive).
MARQUES = {
    "bpost": ["bpost.be", "bpost.cloud"],
    "spf finances": ["fgov.be", "belgium.be"],
    "myminfin": ["fgov.be", "belgium.be"],
    "ebox": ["belgium.be", "fgov.be"],
    "csam": ["belgium.be", "fgov.be", "csam.be"],
    "itsme": ["itsme-id.com", "itsme.be"],
    "belfius": ["belfius.be"],
    "ing": ["ing.be"],
    "kbc": ["kbc.be"],
    "bnp paribas fortis": ["bnpparibasfortis.be"],
    "fortis": ["bnpparibasfortis.be"],
    "argenta": ["argenta.be"],
    "proximus": ["proximus.be"],
    "orange": ["orange.be"],
    "engie": ["engie.be"],
    "luminus": ["luminus.be"],
    "fluvius": ["fluvius.be"],
    "ores": ["ores.be"],
    "police": ["police.be", "belgium.be"],
    "card stop": ["cardstop.be"],
    "mutualite": ["mc.be", "solidaris.be", "partenamut.be", "mloz.be", "helan.be", "lamutualitelibre.be"],
    "solidaris": ["solidaris.be"],
    "netflix": ["netflix.com"],
    "amazon": ["amazon.com", "amazon.fr", "amazon.com.be", "amazon.de"],
}

RACCOURCISSEURS = {"bit.ly", "tinyurl.com", "t.ly", "cutt.ly", "is.gd", "shorturl.at",
                   "rb.gy", "ow.ly", "t.co", "s.id", "tiny.cc", "buff.ly"}
TLD_SUSPECTS = {"xyz", "top", "click", "shop", "online", "site", "icu", "live", "buzz",
                "monster", "rest", "sbs", "cfd", "store", "info", "vip", "cyou"}

# (motif, points, explication). Les motifs s'appliquent au texte sans accents, en minuscules.
REGLES_TEXTE = [
    (r"code (pin|secret|itsme|de reponse|d.activation)|digipass|mot de passe|identifiants?"
     r"|numero de (votre )?carte|code cvv|cvc|lecteur de carte",
     4, "On vous demande un code, un mot de passe ou les données de votre carte. "
        "Une banque, itsme ou l'administration ne le demandent JAMAIS par message."),
    (r"urgent|immediatement|dernier rappel|derniere chance|sous 24 ?h|dans les 24 heures"
     r"|sous 48 ?h|aujourd.hui (seulement|avant)|sans delai|au plus vite",
     2, "Le message vous presse. Les escrocs créent l'urgence pour vous empêcher de réfléchir."),
    (r"suspendu|bloque|desactive|expire|sera (ferme|cloture|supprime)|acces restreint",
     2, "Le message menace de bloquer un compte ou un service. C'est une technique de peur classique."),
    (r"frais de (livraison|douane|port|reexpedition)|colis (en attente|retenu|bloque|non livre)"
     r"|adresse (incomplete|incorrecte)",
     3, "On vous parle d'un colis bloqué ou de petits frais à payer. C'est une des arnaques les plus fréquentes."),
    (r"nouveau numero|telephone (est )?(casse|tombe|perdu)|c.est (moi|ton fils|ta fille)"
     r"|(maman|papa|mamy|papy|mamie|papi)\b.*(numero|whatsapp)",
     4, "Quelqu'un dit être un proche avec un nouveau numéro. Appelez votre proche sur son ANCIEN numéro avant toute chose."),
    (r"virement|payer|paiement|regler|reglement|montant de|versez",
     1, "Le message demande de l'argent."),
    (r"remboursement|vous avez gagne|gagnant|heritage|loterie|cadeau|prime exceptionnelle"
     r"|investiss|crypto|bitcoin|rendement garanti",
     2, "On vous promet de l'argent ou un gain. Si c'est trop beau, c'est presque toujours faux."),
    (r"ne (le )?dites (rien|a personne)|restez discret|confidentiel",
     3, "On vous demande de garder le secret. Un vrai service ne demande jamais cela."),
    (r"carte (gift|cadeau|paysafe|google play|itunes|steam)|paysafecard|western union|moneygram",
     5, "On vous demande de payer avec des cartes cadeaux ou par transfert d'argent : c'est toujours une arnaque."),
    (r"anydesk|teamviewer|quicksupport|installez (l.application|le logiciel)|prendre le controle",
     5, "On veut prendre le contrôle de votre ordinateur ou téléphone à distance. N'installez rien."),
    (r"cliquez|cliquer|appuyez sur le lien|suivez le lien|mettez a jour vos (donnees|informations)",
     1, "On vous pousse à cliquer sur un lien."),
]

URL_RE = re.compile(r"(https?://[^\s<>\"']+|www\.[^\s<>\"']+|\b[a-z0-9.-]+\.[a-z]{2,10}/[^\s<>\"']*)",
                    re.IGNORECASE)


def sans_accents(texte: str) -> str:
    texte = unicodedata.normalize("NFD", texte)
    return "".join(c for c in texte if unicodedata.category(c) != "Mn").lower()


def _domaine(url: str) -> str:
    if not url.lower().startswith("http"):
        url = "http://" + url
    hote = (urlparse(url).hostname or "").lower()
    return hote[4:] if hote.startswith("www.") else hote


def _appartient(hote: str, domaines) -> bool:
    return any(hote == d or hote.endswith("." + d) for d in domaines)


def analyser(texte: str) -> dict:
    """Retourne {'verdict', 'score', 'raisons', 'liens', 'marques'}."""
    brut = texte or ""
    t = sans_accents(brut)
    score, trouvees = 0, {}

    def ajouter(points, raison):
        nonlocal score
        score += points
        trouvees[raison] = max(points, trouvees.get(raison, 0))

    for motif, points, raison in REGLES_TEXTE:
        if re.search(motif, t):
            ajouter(points, raison)

    marques = [m for m in MARQUES if re.search(r"\b" + re.escape(m) + r"\b", t)]

    liens = [u.rstrip(".,;:!?)") for u in URL_RE.findall(brut)]
    hotes = [h for h in (_domaine(u) for u in liens) if h]
    for hote in hotes:
        if hote in RACCOURCISSEURS:
            ajouter(2, f"Le lien «\u00a0{hote}\u00a0» cache la vraie adresse du site.")
        if re.fullmatch(r"[\d.]+", hote):
            ajouter(3, "Le lien est une suite de chiffres au lieu d'un nom de site : très suspect.")
        if hote.rsplit(".", 1)[-1] in TLD_SUSPECTS:
            ajouter(2, f"Le lien se termine par «\u00a0.{hote.rsplit('.', 1)[-1]}\u00a0», une terminaison souvent utilisée par les escrocs.")
        if re.search(r"(secur|verif|login|update|confirm|client|support|paiement|colis|rembourse)", hote):
            ajouter(1, f"L'adresse «\u00a0{hote}\u00a0» utilise des mots rassurants pour imiter un site officiel.")
        elif hote.count("-") >= 2:
            ajouter(1, f"L'adresse «\u00a0{hote}\u00a0» est inhabituelle, avec beaucoup de tirets.")
        for m in marques:
            if not _appartient(hote, MARQUES[m]):
                ajouter(3, f"Le message parle de «\u00a0{m}\u00a0» mais le lien mène à «\u00a0{hote}\u00a0», "
                           f"qui n'est pas le site officiel ({', '.join(MARQUES[m])}).")
    if liens and not trouvees:
        ajouter(1, "Le message contient un lien. N'y allez pas depuis le message : tapez vous-même l'adresse officielle.")

    # Les raisons les plus graves d'abord ; l'interface n'en montre que 3.
    raisons = sorted(trouvees, key=trouvees.get, reverse=True)
    if score >= SEUIL_ROUGE:
        verdict = "rouge"
    elif score >= SEUIL_ORANGE:
        verdict = "orange"
    else:
        verdict = "vert"
    return {"verdict": verdict, "score": score, "raisons": raisons,
            "liens": liens, "marques": marques}


CONSEILS = {
    "rouge": [
        "Ne cliquez sur aucun lien et ne répondez pas.",
        "Ne donnez aucun code, mot de passe ou numéro de carte.",
        "Transférez le message à suspect@safeonweb.be, puis supprimez-le.",
        "Si vous avez déjà donné des données bancaires : appelez Card Stop au 078 170 170, puis votre banque.",
        "Parlez-en à votre aidant : il n'y a aucune honte, tout le monde peut être visé.",
    ],
    "orange": [
        "Ne cliquez pas sur le lien du message.",
        "Vérifiez en contactant l'organisme vous-même, avec le numéro de votre carte ou de vos courriers habituels.",
        "En cas de doute, demandez à votre aidant avant d'agir.",
    ],
    "vert": [
        "S'il y a un lien, n'y allez pas depuis le message : tapez vous-même l'adresse du site officiel.",
        "Rappel : votre banque, itsme ou l'administration ne vous demanderont jamais votre code.",
        "Si quelque chose vous semble bizarre, demandez à votre aidant.",
    ],
}
