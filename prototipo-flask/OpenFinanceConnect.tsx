import { PluggyConnect } from 'react-pluggy-connect'
import { useEffect, useState } from 'react'

// Nenhuma credencial da Pluggy aqui: o navegador só recebe o Connect Token
// (curta duração) gerado pelo backend em /api/connect-token.

type Props = {
  clientUserId: string
  // Em desenvolvimento use true para ver o "Pluggy Bank" de testes. Em produção, false.
  includeSandbox?: boolean
  onConnected?: (itemId: string) => void
}

export function OpenFinanceConnect({ clientUserId, includeSandbox = false, onConnected }: Props) {
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetch('/api/connect-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientUserId }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Falha ao gerar token')
        return res.json()
      })
      .then((data) => !cancelled && setConnectToken(data.accessToken))
      .catch((err: Error) => !cancelled && setError(err.message))

    return () => {
      cancelled = true
    }
  }, [clientUserId])

  if (error) return <div role="alert">Não foi possível conectar ao banco: {error}</div>
  if (!connectToken) return <div>Carregando…</div>
  if (!open) return null

  return (
    <PluggyConnect
      connectToken={connectToken}
      includeSandbox={includeSandbox}
      onSuccess={async ({ item }) => {
        // Salva o itemId no backend: é com ele que o Rastro vai buscar as transações
        const res = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientUserId, itemId: item.id }),
        })
        if (!res.ok) {
          setError('Banco conectado, mas falhou ao salvar a conexão. Tente novamente.')
          return
        }
        onConnected?.(item.id)
      }}
      onError={(err) => {
        console.error('Pluggy Connect: falha na conexão', err)
      }}
      onClose={() => setOpen(false)}
    />
  )
}
