import { PLATE } from './data/set'
import { Radio } from './components/Radio'
import { useEngine } from './radio/useEngine'

export default function App() {
  const engine = useEngine()
  return <Radio engine={engine} plate={PLATE} />
}
