"""
Baixa EXPEDIDOS antigos (2007-2024) + PAGOS (2007-2026) do STJ.
Pula RPVs (acima de 60 SM = só PRC).
"""
import os, urllib.request, urllib.parse, json

OUT_DIR = r'C:\AuraLOA-Confidencial\stj-precatorios\raw'
os.makedirs(OUT_DIR, exist_ok=True)

def absolutize(url):
    if url.startswith('https://sites/'):
        return url.replace('https://sites/', 'https://www.stj.jus.br/sites/')
    return url

# Lista coletada do WebFetch — apenas EXPEDIDOS antigos + PAGOS (sem RPV)
DOWNLOADS = [
    # === EXPEDIDOS 2007-2024 ===
    ('EXPEDIDO', '2024-Uniao-Alimentar', 'https://sites/portalp/SiteAssets/Processos/precatorios/Precatorios-Expedidos-Uniao-Alimentar.xlsx'),
    ('EXPEDIDO', '2024-Uniao-Comum', 'https://sites/portalp/SiteAssets/Processos/precatorios/Precatorios-Expedidos-uniao-comum.xlsx'),
    ('EXPEDIDO', '2023-Uniao-Alimentar', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-2023-UNIAO-ALIMENTAR.xlsx'),
    ('EXPEDIDO', '2023-Uniao-Comum', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-2023-UNIAO-COMUM.xlsx'),
    ('EXPEDIDO', '2022-Uniao-Alimentar', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PRCs-2022-UNI%c3%83O-ALIMENTAR.xlsx'),
    ('EXPEDIDO', '2022-Uniao-Comum', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PRCs-2022-UNI%c3%83O-COMUM.xlsx'),
    ('EXPEDIDO', '2022-Estado-GO-proposta-2023', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/Precatorios_proposta_2023_Estado-GO.xlsx'),
    ('EXPEDIDO', '2021-PROPOSTA-2022-Uniao-retif', 'https://transparencia.stj.jus.br/wp-content/uploads/PRC-PROPOSTA-2022-UNIAO-retificacao.xlsm'),
    ('EXPEDIDO', '2021-PROPOSTA-2022-INSS-Alim', 'https://transparencia.stj.jus.br/wp-content/uploads/PROPOSTA-2022-ALIMENTAR-INSS.xlsm'),
    ('EXPEDIDO', '2021-PROPOSTA-2022-FN-Alim', 'https://transparencia.stj.jus.br/wp-content/uploads/PROPOSTA-2022-ALIMENTAR-FAZ-NACIONAL.xlsm'),
    ('EXPEDIDO', '2021-PROPOSTA-2022-UFOP-Alim', 'https://transparencia.stj.jus.br/wp-content/uploads/PROPOSTA-2022-ALIMENTAR-UFOP.xlsm'),
    ('EXPEDIDO', '2021-PROPOSTA-2022-Uniao-Comum', 'https://transparencia.stj.jus.br/wp-content/uploads/PROPOSTA-2022-COMUM-UNIAO.xlsm'),
    ('EXPEDIDO', '2021-PORTAL-Outras-Devedoras', 'https://transparencia.stj.jus.br/wp-content/uploads/PORTAL-PRCs-a-serem-pagos-em-2022-OUTRAS-ENTIDADES-DEVEDORAS.xlsm'),
    ('EXPEDIDO', '2020-Uniao-Alim', 'https://transparencia.stj.jus.br/wp-content/uploads/alimentar-devedora-uniao.xlsm'),
    ('EXPEDIDO', '2020-INSS-Alim', 'https://transparencia.stj.jus.br/wp-content/uploads/alimentar-devedora-inss.xlsm'),
    ('EXPEDIDO', '2020-Uniao-Comum', 'https://transparencia.stj.jus.br/wp-content/uploads/comum-devedora-uniao.xlsm'),
    ('EXPEDIDO', '2019-PRCs-autuados-2018-2019', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-autuados-2_7_18-a-1_7_19-proposta.xlsm'),
    ('EXPEDIDO', '2018-PRCs-autuados-2017-2018', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-autuados-2.7.17-a-1.7.18.xlsm'),
    ('EXPEDIDO', '2017-Precatorios-2016-2017', 'https://transparencia.stj.jus.br/wp-content/uploads/Precatorios-expedidos-02jul2016-a-01jul2017.xlsm'),
    ('EXPEDIDO', '2016', 'https://transparencia.stj.jus.br/wp-content/uploads/2016.xlsm'),
    # PDFs antigos (2007-2015) — não conseguimos parsear automaticamente, mas baixamos pra arquivar
    ('EXPEDIDO-PDF', '2015', 'https://transparencia.stj.jus.br/wp-content/uploads/RELACAO-DOS-PRCs-EXPEDIDOS-ATE-01-07-2015.pdf'),
    ('EXPEDIDO-PDF', '2014', 'https://transparencia.stj.jus.br/wp-content/uploads/precatorios_2014.pdf'),
    ('EXPEDIDO-PDF', '2013', 'https://transparencia.stj.jus.br/wp-content/uploads/precatorios_2013.pdf'),
    ('EXPEDIDO-PDF', '2012', 'https://transparencia.stj.jus.br/wp-content/uploads/2665_Relacao_dos_precatorios_EXPEDIDOS_em_2012.pdf'),
    ('EXPEDIDO-PDF', '2011', 'https://transparencia.stj.jus.br/wp-content/uploads/Precatorios-2011.pdf'),
    ('EXPEDIDO-PDF', '2010', 'https://transparencia.stj.jus.br/wp-content/uploads/2663_Relacao_dos_precatorios_EXPEDIDOS_em_2010.pdf.pdf'),
    ('EXPEDIDO-PDF', '2007-2009', 'https://transparencia.stj.jus.br/wp-content/uploads/1726_Relatorios_anexo_II_Acompanhamento_da_Execucao_orcamentaria.pdf'),

    # === PAGOS 2026 ===
    ('PAGO', '2026-02', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-02_2026-Portal-SisSEPREC.xlsx'),
    ('PAGO', '2026-03-INSS-Alim', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-032026-INSS-alimentar.xlsx'),
    ('PAGO', '2026-03-Uniao-Alim', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-032026-UniaoAlimentar.xlsx'),
    ('PAGO', '2026-03-Uniao-Comum', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-032026-UniaoComum.xlsx'),

    # === PAGOS 2025 ===
    ('PAGO', '2025-12', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-dezembro.xlsx'),
    ('PAGO', '2025-11', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-Nov2025-SisSEPREC.xlsx'),
    ('PAGO', '2025-10-Uniao-Comum', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs_uniao_comum_outubro_2025.xlsm'),
    ('PAGO', '2025-09-Uniao-Comum', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs_uniao_comum_setembro_202.xlsm'),
    ('PAGO', '2025-08-Uniao-Comum', 'https://sites/portalp/SiteAssets/Processos/precatorios/Uniao_comum_agosto_2025.xlsm'),
    ('PAGO', '2025-07-INSS-Alim', 'https://sites/portalp/SiteAssets/Processos/precatorios/INSS-ALIMENTAR-Julho-2025.xlsm'),
    ('PAGO', '2025-07-Uniao-Alim', 'https://sites/portalp/SiteAssets/Processos/precatorios/UNIAO-ALIMENTAR-Julho-2025.xlsm'),
    ('PAGO', '2025-07-Uniao-Comum', 'https://sites/portalp/SiteAssets/Processos/precatorios/UNIAO%20-%20COMUM-Julho-2025.xlsm'),
    ('PAGO', '2025-06', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-0625.xlsm'),
    ('PAGO', '2025-05', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos%20MAIO-2025%20-%20PORTAL.xlsm'),
    ('PAGO', '2025-04', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-ABR-2025.xlsm'),
    ('PAGO', '2025-03', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs_pagos_MAR-2025.xlsm'),
    ('PAGO', '2025-02', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos%20FEV-2025.xlsm'),

    # === PAGOS 2024 ===
    ('PAGO', '2024-12', 'https://sites/portalp/SiteAssets/Processos/precatorios/12%20-%20PRCs%20pagos%20DEZ-2024%20-%20PORTAL.xlsm'),
    ('PAGO', '2024-11', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos%20NOV-2024%20-%20PORTAL.xlsm'),
    ('PAGO', '2024-10', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs_pagos_OUT-2024.xlsm'),
    ('PAGO', '2024-09', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-SET-2024.xlsm'),
    ('PAGO', '2024-08', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PRCs%20pagos%20AGO-2024.xlsm'),
    ('PAGO', '2024-07-Uniao-Comum', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/Uniao-natureza_comum_Julho-2024.xlsm'),
    ('PAGO', '2024-06-Uniao-Comum', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/Uniao-natureza-comum-JUN.xlsm'),
    ('PAGO', '2024-05', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PRCs-pagos-MAI-2024.xlsm'),
    ('PAGO', '2024-04-Uniao-Comum', 'https://sites/portalp/SiteAssets/Processos/precatorios/UNIAO_COMUM-Abr_2024.xlsx.xlsm'),
    ('PAGO', '2024-02-INSS-Alim', 'https://sites/portalp/SiteAssets/Processos/precatorios/INSS_ALIMENTAR-Fev_2024.xlsx'),
    ('PAGO', '2024-02-Uniao-Alim', 'https://sites/portalp/SiteAssets/Processos/precatorios/UNIAO_ALIMENTAR-Fev_2024.xlsx'),
    ('PAGO', '2024-02-Uniao-Comum', 'https://sites/portalp/SiteAssets/Processos/precatorios/UNIAO_COMUM-Fev_2024.xlsx'),

    # === PAGOS 2023 ===
    ('PAGO', '2023-12-Exec-2024-INSS', 'https://sites/portalp/SiteAssets/Processos/Precatorios/PRCs-pagos-DEZ-2023-Exercicio-2024-INSS.xlsm'),
    ('PAGO', '2023-12-Exec-2024-Uniao', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-DEZ-2023-Exercicio-2024-UNIAO.xlsm'),
    ('PAGO', '2023-12-Exec-2023-FN-Alim', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-DEZ-2023-Exercicio-2023-FAZENDA-ALIMENTAR.xlsm'),
    ('PAGO', '2023-12-Exec-2023-INSS-Alim', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PRCs_pagos-DEZ-2023-Exercicio-2023-INSS-ALIMENTAR.xlsm'),
    ('PAGO', '2023-12-Exec-2023-Uniao-Alim', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-DEZ-2023-Exercicio-2023-UNIAO-ALIMENTAR.xlsm'),
    ('PAGO', '2023-12-Exec-2023-Uniao-Comum', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-DEZ-2023-Exerc%c3%adcio2023-UNIAO-COMUM.xlsm'),
    ('PAGO', '2023-12-Pendentes-2022-Alim', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-DEZ-2023-PENDENTES-DE-2022-ALIMENTAR.xlsm'),
    ('PAGO', '2023-12-Pendentes-2022-Comum', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-DEZ-2023-PENDENTES-DE-2022-COMUM.xlsm'),
    ('PAGO', '2023-12-Proposta-2020', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-DEZ-2023-PROPOSTA-DE-2020.xlsm'),
    ('PAGO', '2023-11', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos-NOV-2023.xlsx'),
    ('PAGO', '2023-09', 'https://sites/portalp/SiteAssets/Processos/precatorios/PRCs-pagos%20-%20SET-2023.xlsm'),
    ('PAGO', '2023-08', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/8%20-PORTAL%20-%20PRCs%20pagos%20-%20AGO-2023.xlsm'),
    ('PAGO', '2023-07-INSS-Alim', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PRCs-pagos_JUL-2023-inss-alimentar.xlsm'),
    ('PAGO', '2023-07-Uniao-Alim', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PRCs-pagos_JUL-2023-uniao-alimentar.xlsm'),
    ('PAGO', '2023-07-Uniao-Comum', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PRCs-pagos_JUL-2023-uniao-comum.xlsm'),
    ('PAGO', '2023-06-INSS-Alim', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PORTAL-PRCs-pagos-JUN-2023-INSS-Alimentar.xlsm'),
    ('PAGO', '2023-06-Uniao-Alim', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PORTAL-PRCs-pagos-JUN-2023-Uniao.Alimentar.xlsm'),
    ('PAGO', '2023-05-INSS', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PORTAL_PRCs_pagos_MAI_2023_INSS.xlsm'),
    ('PAGO', '2023-05-Uniao', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PORTAL_PRCs_pagos_MAI_2023_UNIAO.xlsm'),

    # === PAGOS 2022 ===
    ('PAGO', '2022-10-INSS-Alim', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PRCs-pagos_OUT-2022-INSS-alimentar.xlsm'),
    ('PAGO', '2022-10-Uniao-Alim', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PRCs-pagos_OUT-2022-uniao-alimentar.xlsm'),
    ('PAGO', '2022-09', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/Portal_PRCs-pagos_SET-2022.xlsm'),
    ('PAGO', '2022-08-INSS-Alim', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PORTAL%20-%20PRCs%20pagos%20em%20AGO-2022-%20INSS%20ALIMENTAR.xlsm'),
    ('PAGO', '2022-08-Uniao-Alim', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PORTAL%20-%20PRCs%20pagos%20em%20AGO-2022-%20UNI%c3%83O%20ALIMENTAR.xlsm'),
    ('PAGO', '2022-08-UFOP-Alim', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PORTAL%20-%20PRCs%20pagos%20em%20AGO-2022-%20UFOP%20ALIMENTAR.xlsm'),
    ('PAGO', '2022-07-INSS-Alim', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/prcs-pagos-jul-2022-inss-alimentar.xlsm'),
    ('PAGO', '2022-07-Uniao-Alim', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/prcs-pagos-jul-2022-uniao-alimentar.xlsm'),
    ('PAGO', '2022-07-FN-Alim', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/prcs-pagos-jul-2022-fazenda-alimentar.xlsm'),

    # === PAGOS 2021 ===
    ('PAGO', '2021-12-INSS', 'https://transparencia.stj.jus.br/wp-content/uploads/PORTAL-PRCs-pagos-em-DEZ-2021-inss-alimentar-.xlsm'),
    ('PAGO', '2021-12-Uniao', 'https://transparencia.stj.jus.br/wp-content/uploads/PORTAL-PRCs-pagos-em-DEZ-2021-uniao-alimentar-.xlsm'),
    ('PAGO', '2021-11-Uniao-Comum', 'https://transparencia.stj.jus.br/wp-content/uploads/PORTAL-PRCs-pagos-em-NOV-2021-UNIAO-COMUM.xlsm'),
    ('PAGO', '2021-11-Uniao-Alim', 'https://transparencia.stj.jus.br/wp-content/uploads/PORTAL-PRCs-pagos-em-NOV-2021-UNIAO-ALIMENTAR.xlsm'),
    ('PAGO', '2021-11-INSS', 'https://transparencia.stj.jus.br/wp-content/uploads/PORTAL-PRCs-pagos-em-NOV-2021-INSS-ALIMENTAR.xlsm'),
    ('PAGO', '2021-10-Uniao', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-OUT2021-Uniao-alimentar.xlsm'),
    ('PAGO', '2021-10-INSS', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-OUT2021-INSS-alimentar.xlsm'),
    ('PAGO', '2021-09-Uniao-Comum', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-SET2021-Uniao-comum.xlsm'),
    ('PAGO', '2021-09-Uniao-Alim', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-SET2021-Uniao-alimentar.xlsm'),
    ('PAGO', '2021-09-INSS', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-SET2021-INSS-alimentar.xlsm'),
    ('PAGO', '2021-08-Uniao-Comum', 'https://transparencia.stj.jus.br/wp-content/uploads/PORTAL-PRCs-pagos-em-AGO-2021-UNIAO-comum.xlsm'),
    ('PAGO', '2021-08-Uniao-Alim', 'https://transparencia.stj.jus.br/wp-content/uploads/PORTAL-PRCs-pagos-em-AGO-2021-UNIAO-alimentar.xlsm'),
    ('PAGO', '2021-08-INSS', 'https://transparencia.stj.jus.br/wp-content/uploads/PORTAL-PRCs-pagos-em-AGO-2021-INSS-alimentar.xlsm'),

    # === PAGOS 2020 ===
    ('PAGO', '2020-Uniao-Comum-cumul', 'https://transparencia.stj.jus.br/wp-content/uploads/prcs_pagos_uniao_comum.xlsx'),
    ('PAGO', '2020-Uniao-Alim-cumul', 'https://transparencia.stj.jus.br/wp-content/uploads/prcs_pagos_uniao_alimentar.xlsx'),
    ('PAGO', '2020-INSS-Alim-cumul', 'https://transparencia.stj.jus.br/wp-content/uploads/prcs_pagos_inss_alimentar.xlsx'),
    ('PAGO', '2020-11-Uniao-Alim', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-Nov2020-Uniao-Natureza_Alimentar.xlsx'),
    ('PAGO', '2020-11-INSS', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-Nov2020-INSS-Natureza_Alimentar.xlsx'),
    ('PAGO', '2020-10-Uniao-Comum', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-Out2020-Uniao-Natureza_Comum.xlsx'),
    ('PAGO', '2020-10-Uniao-Alim', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-Out2020-Uniao-Natureza_Alimentar.xlsx'),
    ('PAGO', '2020-10-INSS', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-Out2020-INSS-Natureza_Alimentar.xlsx'),
    ('PAGO', '2020-09-Uniao-Comum', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-Set2020-Uniao-Natureza_Comum.xlsx'),
    ('PAGO', '2020-09-Uniao-Alim', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-Set2020-Uniao-Natureza_Alimentar.xlsx'),
    ('PAGO', '2020-09-INSS', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-Set2020-INSS-Natureza_Alimentar.xlsx'),
    ('PAGO', '2020-09-FN', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-Set2020-Fazenda_Nacional-Natureza_Alimentar.xlsx'),
    ('PAGO', '2020-08-Uniao-Alim', 'https://transparencia.stj.jus.br/wp-content/uploads/PRCs-pagos-Ago2020-Uniao-Natureza_Alimentar.xlsx'),

    # === MAPAS ANUAIS adicionais ===
    ('MAPA', 'mapa-2024', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/mapa-anual-PRCs-CNJ-ano-base-2024.xlsx'),
    ('MAPA', 'mapa-2023', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/mapa-anual-PRCs-CNJ-ano-base-2023.xlsx'),
    ('MAPA', 'mapa-2022', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/mapa-anual-PRCs-CNJ-ano-base-2022.xlsx'),
    ('MAPA', 'mapa-2021', 'https://transparencia.stj.jus.br/wp-content/uploads/mapa-anual-PRCs-CNJ-ano-base-2021.xlsx'),
    ('MAPA', 'mapa-2020', 'https://transparencia.stj.jus.br/wp-content/uploads/Mapa-Anual-de-Precatorios_2020.xlsx'),
    ('MAPA', 'mapa-2019', 'https://transparencia.stj.jus.br/wp-content/uploads/Mapa-Anual-de-Precatorios_2019.xlsx'),

    # === Listas EC 114/2021 e Art 107-A ADCT ===
    ('LISTA-PAGAMENTO', 'EC-114-2022', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/Precatorios-para-Pagamento-2022.xlsx'),
    ('LISTA-PAGAMENTO', 'Art-107A-ADCT-2023', 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/Planilha_para_Indicacao_de_Precatorios_para_Pagamento_2023.xlsx'),
]

# Carregar manifest existente pra acumular
manifest_path = os.path.join(OUT_DIR, '_MANIFEST.json')
existing = []
if os.path.exists(manifest_path):
    with open(manifest_path, 'r', encoding='utf-8') as f:
        existing = json.load(f)
existing_fnames = {m['fname'] for m in existing}

novos = []
ok = 0
err = 0
for cat, label, url in DOWNLOADS:
    abs_url = absolutize(url)
    ext = os.path.splitext(urllib.parse.urlparse(abs_url).path)[1] or '.xlsx'
    fname = f'{cat}__{label}{ext}'
    fpath = os.path.join(OUT_DIR, fname)
    if fname in existing_fnames or os.path.exists(fpath):
        print(f'  [skip] {fname}')
        continue
    try:
        req = urllib.request.Request(abs_url, headers={'User-Agent':'Mozilla/5.0 AuraLOA-Research/1.0'})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        with open(fpath, 'wb') as f:
            f.write(data)
        novos.append({'cat':cat,'label':label,'url':abs_url,'fname':fname,'size':len(data),'status':'OK'})
        ok += 1
        print(f'  [OK] {fname} ({len(data)//1024}KB)')
    except Exception as e:
        novos.append({'cat':cat,'label':label,'url':abs_url,'fname':fname,'size':0,'status':f'ERRO: {e}'})
        err += 1
        print(f'  [ERRO] {fname}: {str(e)[:80]}')

# Atualizar manifest
all_manifest = existing + novos
with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(all_manifest, f, ensure_ascii=False, indent=2)

print(f'\n[expedidos+pagos] novos: {ok} ok, {err} erros')
print(f'Total no manifest: {len(all_manifest)}')
