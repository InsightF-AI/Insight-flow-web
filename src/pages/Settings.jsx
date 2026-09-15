import SettingsPanel from '../components/SettingsPanel.jsx';

/** Rota direta /configuracoes (acesso por link/atualização de página).
 * A partir do menu, Configurações abre como modal — ver SettingsModal.jsx. */
export default function Settings() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header>
        <h2 className="text-2xl font-bold">Configurações</h2>
        <p className="mt-1">Perfil, segurança, aparência e preferências de notificação.</p>
      </header>
      <SettingsPanel />
    </div>
  );
}
