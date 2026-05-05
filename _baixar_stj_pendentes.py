"""
Baixa lista de PENDENTES + propostas LOA + expedidos sem LOA do STJ.
Cada arquivo recebe URL absoluta. Salva tudo em C:/AuraLOA-Confidencial/stj-precatorios/raw/
"""
import os
import urllib.request
import urllib.parse

OUT_DIR = r'C:\AuraLOA-Confidencial\stj-precatorios\raw'
os.makedirs(OUT_DIR, exist_ok=True)

# Resolução de URL absoluta — WebFetch retornou com prefix "https://sites/..." que é relativo
def absolutize(url):
    if url.startswith('https://sites/'):
        return url.replace('https://sites/', 'https://www.stj.jus.br/sites/')
    return url

# Arquivos a baixar (categoria, nome descritivo, URL relativa do WebFetch)
DOWNLOADS = [
    # === PENDENTES ===
    ('PENDENTE', 'proposta-LOA-2027',           'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PRCs-proposta-2027.xlsx'),
    ('PENDENTE', 'proposta-LOA-2026',           'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PRCs-proposta-2026.xlsx'),
    ('PENDENTE', 'exercicios-anteriores',       'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PRCs%20de%20exerc%c3%adcios%20anteriores%20-%20pendentes.xlsx'),
    ('PENDENTE', 'pendentes-dez-2024',          'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/PRCs_pendentes_dez_2024.xlsm'),
    ('PENDENTE', 'pendentes-dez-2023',          'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/prcs_pendentes_dez_2023.xlsm'),
    ('PENDENTE', 'pendentes-dez-2022',          'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/prcs_pendentes_dez_2022.xlsm'),
    ('PENDENTE', 'pend-pag-dez-2021',           'https://transparencia.stj.jus.br/wp-content/uploads/prcs_pend_pag_dez_2021-impessoal.xlsx'),
    ('PENDENTE', 'pend-pag-dez-2020',           'https://transparencia.stj.jus.br/wp-content/uploads/prcs_pend_pag_dez_2020-impessoal.xlsx'),
    ('PENDENTE', 'pendentes-dez-2019',          'https://transparencia.stj.jus.br/wp-content/uploads/precatorios_pendentes_dez_2019-impessoal.xls'),
    ('PENDENTE', 'pend-pag-31-12-2018',         'https://transparencia.stj.jus.br/wp-content/uploads/prcs_pend_pag_311218.xls'),
    ('PENDENTE', 'pend-pag-31-12-2016',         'https://transparencia.stj.jus.br/wp-content/uploads/prcs_pend_pag_311216.xls'),

    # === EXPEDIDOS (sem LOA ainda — autuados após corte da LOA 2026) ===
    ('EXPEDIDO-SEM-LOA', 'expedidos-2025-Alimentar', 'https://sites/portalp/SiteAssets/Processos/precatorios/Precat%c3%b3rios-Expedidos-Alimentar.xlsm'),
    ('EXPEDIDO-SEM-LOA', 'expedidos-2025-Comum',     'https://sites/portalp/SiteAssets/Processos/precatorios/Precat%c3%b3rios-Expedidos-Comum.xlsm'),

    # === MAPA ANUAL ===
    ('MAPA', 'mapa-anual-2025',                 'https://sites/portalp/SiteAssets/Paginas/Processos/Precatorios/Mapa-Anual-Precatorios-2025.xlsx'),
]

manifest = []
for cat, label, url in DOWNLOADS:
    abs_url = absolutize(url)
    ext = os.path.splitext(urllib.parse.urlparse(abs_url).path)[1] or '.xlsx'
    fname = f'{cat}__{label}{ext}'
    fpath = os.path.join(OUT_DIR, fname)
    try:
        req = urllib.request.Request(abs_url, headers={'User-Agent':'Mozilla/5.0 AuraLOA-Research/1.0'})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        with open(fpath, 'wb') as f:
            f.write(data)
        manifest.append({'cat':cat,'label':label,'url':abs_url,'fname':fname,'size':len(data),'status':'OK'})
        print(f'  [OK] {fname} ({len(data)//1024}KB)')
    except Exception as e:
        manifest.append({'cat':cat,'label':label,'url':abs_url,'fname':fname,'size':0,'status':f'ERRO: {e}'})
        print(f'  [ERRO] {fname}: {e}')

print(f'\nTotal baixados: {sum(1 for m in manifest if m["status"]=="OK")}/{len(manifest)}')
print(f'Pasta: {OUT_DIR}')

# Salvar manifesto
import json
with open(os.path.join(OUT_DIR, '_MANIFEST.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
