import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useProfilo } from '@/hooks/useProfilo'
import { cercaEventiSimili } from '@/hooks/useEventi'
import { StelleInput } from '@/components/Stelle'
import IconaMezzo, { ETICHETTA_MEZZO } from '@/components/IconaMezzo'
import type { TipoViaggio } from '@/lib/database.types'

interface EventoSimile {
  id: string
  nome: string
  data: string
  luogo: string
}

type Mezzo = TipoViaggio | 'dopo'

export default function NuovoEvento() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isAutista } = useProfilo()

  const [passo, setPasso] = useState<1 | 2>(1)

  // Passo 1
  const [nome, setNome] = useState('')
  const [data, setData] = useState('')
  const [ora, setOra] = useState('')
  const [luogo, setLuogo] = useState('')
  const [organizzatore, setOrganizzatore] = useState('')
  const [premio, setPremio] = useState('')
  const [stelle, setStelle] = useState(0)
  const [simili, setSimili] = useState<EventoSimile[]>([])

  // Passo 2
  const [mezzo, setMezzo] = useState<Mezzo | null>(null)

  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      cercaEventiSimili(nome, data || null).then(setSimili)
    }, 300)
    return () => clearTimeout(t)
  }, [nome, data])

  function vaiAlPasso2() {
    if (!nome.trim() || !data || !luogo.trim()) return
    setErrore(null)
    setPasso(2)
  }

  async function crea() {
    if (!user) return
    setSalvataggio(true)
    setErrore(null)

    try {
      // Se passeggero propone un'auto, l'evento nasce "proposto"; in ogni
      // altro caso nasce subito "attivo" (vedi SPEC §4.1).
      const stato = !isAutista && mezzo === 'auto' ? 'proposto' : 'attivo'

      const { data: nuovoEvento, error: erroreEvento } = await supabase
        .from('eventi')
        .insert({
          nome: nome.trim(),
          data,
          ora: ora || null,
          luogo: luogo.trim(),
          organizzatore: organizzatore.trim() || null,
          premio: premio.trim() || null,
          creato_da: user.id,
          stato,
        })
        .select('id')
        .single()

      if (erroreEvento || !nuovoEvento) throw erroreEvento ?? new Error('Errore sconosciuto')

      if (stelle > 0) {
        await supabase
          .from('voti_evento')
          .insert({ evento_id: nuovoEvento.id, user_id: user.id, stelle })
      }

      if (mezzo && mezzo !== 'dopo') {
        if (mezzo === 'auto') {
          if (isAutista) {
            await supabase.from('viaggi').insert({
              evento_id: nuovoEvento.id,
              tipo: 'auto',
              stato: 'confermato',
              autista_id: user.id,
              proposto_da: user.id,
              posti_passeggeri: 4,
            })
          } else {
            await supabase.from('viaggi').insert({
              evento_id: nuovoEvento.id,
              tipo: 'auto',
              stato: 'in_attesa',
              autista_id: null,
              proposto_da: user.id,
              posti_passeggeri: 4,
            })
          }
        } else {
          await supabase.from('viaggi').insert({
            evento_id: nuovoEvento.id,
            tipo: mezzo,
            stato: 'confermato',
            autista_id: null,
            proposto_da: user.id,
            posti_passeggeri: null,
          })
        }
      }

      navigate(`/evento/${nuovoEvento.id}`)
    } catch {
      setErrore('Non sono riuscito a creare l\'evento. Riprova.')
      setSalvataggio(false)
    }
  }

  return (
    <div className="px-5 pt-4 max-w-lg mx-auto pb-10">
      <button
        onClick={() => (passo === 1 ? navigate(-1) : setPasso(1))}
        className="flex items-center gap-1 text-text-muted text-sm mb-4 -ml-1 py-1"
      >
        <ChevronLeft size={18} /> Indietro
      </button>

      <h1 className="font-display text-2xl mb-6">NUOVO EVENTO</h1>

      {passo === 1 && (
        <div className="space-y-4">
          <div>
            <label className="label">Nome evento *</label>
            <input
              className="input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="es. King of the Mic"
            />
          </div>

          {simili.length > 0 && (
            <div className="bg-surface border border-accent/30 rounded-card p-3 space-y-2">
              <p className="text-xs text-text-muted">Esiste già? Apri l'evento invece di duplicarlo:</p>
              {simili.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/evento/${s.id}`)}
                  className="block text-left text-sm text-accent font-medium"
                >
                  {s.nome} — {s.luogo}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data *</label>
              <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <label className="label">Ora</label>
              <input type="time" className="input" value={ora} onChange={(e) => setOra(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Luogo *</label>
            <input
              className="input"
              value={luogo}
              onChange={(e) => setLuogo(e.target.value)}
              placeholder="es. Arci Bellezza, Milano"
            />
          </div>

          <div>
            <label className="label">Organizzatore</label>
            <input className="input" value={organizzatore} onChange={(e) => setOrganizzatore(e.target.value)} />
          </div>

          <div>
            <label className="label">Premio</label>
            <input className="input" value={premio} onChange={(e) => setPremio(e.target.value)} />
          </div>

          <div>
            <label className="label">Le tue stelle</label>
            <StelleInput valore={stelle} onChange={setStelle} />
          </div>

          <button
            className="btn-primary w-full mt-2"
            disabled={!nome.trim() || !data || !luogo.trim()}
            onClick={vaiAlPasso2}
          >
            Avanti
          </button>
        </div>
      )}

      {passo === 2 && (
        <div className="space-y-3">
          <p className="text-text-muted text-sm mb-1">Come ci andate?</p>

          <OpzioneMezzo
            attiva={mezzo === 'auto'}
            onClick={() => setMezzo('auto')}
            icona={<IconaMezzo tipo="auto" />}
            etichetta={isAutista ? 'Auto (vostra)' : 'Auto (chiedi a un autista)'}
          />
          <OpzioneMezzo
            attiva={mezzo === 'treno'}
            onClick={() => setMezzo('treno')}
            icona={<IconaMezzo tipo="treno" />}
            etichetta={ETICHETTA_MEZZO.treno}
          />
          <OpzioneMezzo
            attiva={mezzo === 'pullman'}
            onClick={() => setMezzo('pullman')}
            icona={<IconaMezzo tipo="pullman" />}
            etichetta={ETICHETTA_MEZZO.pullman}
          />
          <OpzioneMezzo
            attiva={mezzo === 'aereo'}
            onClick={() => setMezzo('aereo')}
            icona={<IconaMezzo tipo="aereo" />}
            etichetta={ETICHETTA_MEZZO.aereo}
          />
          <OpzioneMezzo attiva={mezzo === 'dopo'} onClick={() => setMezzo('dopo')} etichetta="Decidiamo dopo" />

          {mezzo === 'auto' && !isAutista && (
            <p className="text-xs text-text-muted px-1">
              L'evento resterà in proposta finché un autista non si rende disponibile.
            </p>
          )}

          {errore && <p className="text-danger text-sm">{errore}</p>}

          <button className="btn-primary w-full mt-2" disabled={!mezzo || salvataggio} onClick={crea}>
            {salvataggio ? 'Creo...' : 'Crea evento'}
          </button>
        </div>
      )}
    </div>
  )
}

function OpzioneMezzo({
  attiva,
  onClick,
  icona,
  etichetta,
}: {
  attiva: boolean
  onClick: () => void
  icona?: React.ReactNode
  etichetta: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-card border px-4 py-3 min-h-[44px] transition-colors duration-150 ${
        attiva ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text'
      }`}
    >
      {icona}
      <span className="font-medium">{etichetta}</span>
    </button>
  )
}
