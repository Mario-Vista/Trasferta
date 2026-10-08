import { createClient } from '@supabase/supabase-js'

// Nota: niente generic <Database> qui. Il client resta "loosely typed" e i
// tipi di dominio in ./database.types.ts si usano esplicitamente nei punti
// in cui servono (cast nelle select, firme delle funzioni helper). Provare
// a far quadrare a mano la forma generica interna di PostgrestFilterBuilder
// con un Database scritto manualmente genera più attriti (inferenze a
// `never`) di quanti ne risolva; con un progetto Supabase vero si può
// rigenerare con `supabase gen types typescript` e reintrodurre il generic.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Mancano VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example in .env e riempilo (vedi README).'
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
