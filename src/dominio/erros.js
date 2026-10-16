// Erro de regra de negócio. O código identifica o problema; a apresentação decide que mensagem mostrar ao utilizador.
export class ErroDominio extends Error {
  constructor(codigo, detalhe) {
    super(detalhe ? `${codigo}: ${detalhe}` : codigo);
    this.name = "ErroDominio";
    this.codigo = codigo;
  }
}
