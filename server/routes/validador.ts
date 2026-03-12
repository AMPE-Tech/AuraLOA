import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { fetchPrecatorioByNumero } from "../services/estoque_datajud";

const router = Router();

const validarSchema = z.object({
  numero_oficio: z.string().min(1).max(100),
  numero_processo: z.string().min(10).max(50),
});

// Endpoint público — sem autenticação, dados limitados (modo gratuito)
router.post("/api/validador/verificar", async (req: Request, res: Response) => {
  const parsed = validarSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Campos obrigatorios: numero_oficio e numero_processo",
      details: parsed.error.issues,
    });
  }

  const { numero_oficio, numero_processo } = parsed.data;

  try {
    const resultado = await fetchPrecatorioByNumero(numero_processo, numero_oficio);
    return res.json(resultado);
  } catch (err: any) {
    return res.status(500).json({
      error: "Não foi possível completar a consulta nas bases oficiais.",
    });
  }
});

export default router;
