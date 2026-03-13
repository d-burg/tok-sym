import { BrowserRouter, Routes, Route } from 'react-router-dom'
import DeviceSelect from './pages/DeviceSelect'
import ProgramDischarge from './pages/ProgramDischarge'
import ControlRoom from './pages/ControlRoom'
import Bibliography from './pages/Bibliography'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DeviceSelect />} />
        <Route path="/program/:deviceId" element={<ProgramDischarge />} />
        <Route path="/run/:deviceId" element={<ControlRoom />} />
        <Route path="/bibliography" element={<Bibliography />} />
      </Routes>
    </BrowserRouter>
  )
}
