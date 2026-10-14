import { Link } from 'react-router-dom'
import { isSampleMode } from '../preview/sampleMode'
export default function SamplePreviewBadge() {
  return import.meta.env.DEV && isSampleMode() ? <Link to="/appearance" className="sample-preview-badge focus-ring">Sample data · Tool edits reset on reload</Link> : null
}
