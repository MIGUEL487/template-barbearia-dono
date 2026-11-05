export const shopCookie = "auto-stilo-shop";
export function selectMembership<
  T extends { barbershop_id: string; role?: string },
>(members: T[], preferred?: string | null) {
  if (!members.length)
    throw Error("Acesso negado: usuário sem vínculo com uma barbearia.");
  if (preferred) {
    const found = members.find((m) => m.barbershop_id === preferred);
    if (found) return found;
    throw Error(
      "Acesso negado à loja selecionada. Selecione uma loja vinculada à sua conta.",
    );
  }
  if (members.length !== 1)
    throw Error("Selecione uma barbearia no menu para continuar.");
  return members[0];
}
