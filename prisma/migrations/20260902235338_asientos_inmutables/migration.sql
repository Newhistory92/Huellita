CREATE OR REPLACE FUNCTION rechazar_modificacion_asiento()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'El libro contable es inmutable: un asiento no se modifica ni se borra. Registrá un asiento de tipo AJUSTE que lo corrija.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER asiento_sin_update
  BEFORE UPDATE ON "AsientoContable"
  FOR EACH ROW EXECUTE FUNCTION rechazar_modificacion_asiento();

CREATE TRIGGER asiento_sin_delete
  BEFORE DELETE ON "AsientoContable"
  FOR EACH ROW EXECUTE FUNCTION rechazar_modificacion_asiento();
