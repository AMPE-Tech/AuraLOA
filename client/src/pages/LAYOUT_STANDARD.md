# AuraTECH — Padrão de Layout para Páginas Públicas

## Regra fundamental
Toda página pública do ecossistema AuraTECH **deve** usar os componentes `<PublicTopbar />` e `<PublicFooter />`. Nunca crie um topbar ou footer próprio.

---

## Como usar

### 1. Copie o template base
Arquivo: `client/src/pages/page-template.tsx`

### 2. Estrutura obrigatória

```tsx
import { PublicTopbar } from "@/components/public-topbar";
import { PublicFooter } from "@/components/public-footer";

export default function MinhaPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicTopbar />
      <div className="p-6 space-y-8 max-w-[1400px] mx-auto">
        {/* SEU CONTEÚDO AQUI */}
        <PublicFooter />
      </div>
    </div>
  );
}
```

---

## Topbar (`<PublicTopbar />`)
- Logo: Shield azul + "AuraTECH" + "Digital Trust Infrastructure" (negrito, 12px)
- Navegação: Sobre Nós / Módulos / Performance / Trust Index / Contato
- Toggle PT/EN + botão "Acessar Plataforma" + menu mobile hamburguer
- Sticky no topo com blur backdrop

## Footer (`<PublicFooter />`)
- 3 colunas: Logo + descrição + redes sociais / Links rápidos / Legal & Compliance
- Emails: suporte@auradue.com / comercial@auradue.com / privacidade@auradue.com
- Rodapé: Lei 13.964/2019 + copyright AuraTECH 2025

---

## Identidade Visual

| Elemento | Valor |
|---|---|
| Logo AuraTECH | `bg-primary` (azul) |
| Logo AuraAUDIT | `bg-amber-500` (âmbar) |
| Fonte descrição logo | `text-[12px] font-semibold text-muted-foreground` |
| Container máximo | `max-w-[1400px] mx-auto` |
| Espaçamento interno | `p-6 space-y-8` |
| Cards de seção | `<Card><CardContent className="p-6">` |

---

## Registre a rota em App.tsx

```tsx
import MinhaPage from "@/pages/minha-page";
<Route path="/minha-rota" component={MinhaPage} />
```

---

## Checklist obrigatório

- [ ] Li `client/src/pages/LAYOUT_STANDARD.md`?
- [ ] Usei `client/src/pages/page-template.tsx` como base?
- [ ] Reutilizei `<PublicTopbar />`?
- [ ] Reutilizei `<PublicFooter />`?
- [ ] Mantive o mesmo shell visual da AuraTECH?
- [ ] Evitei qualquer recriação manual de header/footer?
