'use client'

import { useState } from 'react'
import { Sparkles, MessageSquare, Settings, FileText, Save, Rocket, Send, Paperclip, ThumbsUp, Copy, Share2, CheckCircle2, Circle, ChevronDown } from 'lucide-react'

const conversation = [
  { id: 1, role: 'assistant', text: 'Hola. Soy tu agente de prueba. ¿En qué puedo ayudarte hoy?' },
]

export default function AgentBuilderView({ onNotify }: { onNotify: (message: string) => void }) {
  const [tab, setTab] = useState('Test Agent')
  const [messages, setMessages] = useState(conversation)
  const [input, setInput] = useState('')
  const [agentName, setAgentName] = useState('Agente Asistente')
  const [status, setStatus] = useState('Inactivo')
  const [language, setLanguage] = useState('Español')
  const [purpose, setPurpose] = useState('Atención al cliente')
  const [company, setCompany] = useState('Muebles del Sur')
  const [companyDesc, setCompanyDesc] = useState('Empresa de distribución y logística')
  const [model, setModel] = useState('GPT-4o')
  const [temperature, setTemperature] = useState(0.4)
  const [instructions, setInstructions] = useState('Responde de forma útil, breve y profesional.')
  const [saved, setSaved] = useState(false)

  function sendMessage() {
    const text = input.trim()
    if (!text) return
    setMessages((current) => [...current, { id: Date.now(), role: 'user', text }])
    setInput('')
    setTimeout(() => {
      setMessages((current) => [...current, { id: Date.now() + 1, role: 'assistant', text: 'Respuesta demo del agente en modo prueba.' }])
    }, 700)
  }

  function save() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onNotify('Cambios guardados')
  }

  function publish() {
    setStatus('Publicado')
    onNotify('Agente publicado')
  }

  return (
    <div className="agent-builder">
      <div className="builder-left">
        <div className="chat-header">
          <div className="chat-brand"><Sparkles size={18} /><span>Agent Studio</span></div>
          <span className={`status-pill ${status === 'Publicado' ? 'ok' : 'idle'}`}><span /><b>{status}</b></span>
        </div>

        <div className="chat-messages">
          {messages.map((message) => (
            <div key={message.id} className={`chat-message ${message.role}`}>
              <div className="chat-avatar">{message.role === 'assistant' ? <Sparkles size={15} /> : 'AR'}</div>
              <div className="chat-bubble">
                <small>{message.role === 'assistant' ? 'Asistente' : 'Tú'}</small>
                <p>{message.text}</p>
                {message.role === 'assistant' && (
                  <div className="chat-actions">
                    <button aria-label="Valorar" onClick={() => onNotify('Respuesta valorada')}><ThumbsUp size={13} /></button>
                    <button aria-label="Copiar" onClick={() => onNotify('Respuesta copiada')}><Copy size={13} /></button>
                    <button aria-label="Compartir" onClick={() => onNotify('Respuesta compartida')}><Share2 size={13} /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="chat-composer">
          <label className="attach-button" aria-label="Adjuntar archivo">
            <Paperclip size={17} />
            <input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) onNotify(`${file.name} adjuntado`) }} />
          </label>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) sendMessage() }} placeholder="Escribe una instrucción para el agente..." aria-label="Escribe un mensaje" />
          <button className="send-button" onClick={sendMessage} aria-label="Enviar"><Send size={18} /></button>
        </div>
      </div>

      <div className="builder-right">
        <div className="config-header">
          <div>
            <h3>{agentName}</h3>
            <span className={`status-pill ${status === 'Publicado' ? 'ok' : 'idle'}`}><span /><b>{status}</b></span>
          </div>
          <div className="config-actions">
            <button className="secondary-button" onClick={save}>{saved ? <><CheckCircle2 size={14} /> Guardado</> : <><Save size={14} /> Guardar</>}</button>
            <button className="primary-button" onClick={publish}><Rocket size={14} /> Publicar</button>
          </div>
        </div>

        <div className="config-tabs">
          {['Test Agent', 'Settings', 'Instructions'].map((item) => (
            <button key={item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>
              {item === 'Test Agent' && <MessageSquare size={14} />}
              {item === 'Settings' && <Settings size={14} />}
              {item === 'Instructions' && <FileText size={14} />}
              <span>{item}</span>
            </button>
          ))}
        </div>

        <div className="config-panel">
          {tab === 'Test Agent' && (
            <div className="config-block">
              <p>Usa el panel izquierdo para conversar con el agente y validar su comportamiento antes de publicarlo.</p>
              <div className="config-card">
                <div><span>Modelo activo</span><b>{model}</b></div>
                <div><span>Idioma</span><b>{language}</b></div>
                <div><span>Temperature</span><b>{temperature.toFixed(1)}</b></div>
              </div>
            </div>
          )}

          {tab === 'Settings' && (
            <div className="config-block">
              <label className="field">
                <span>Language</span>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option>Español</option>
                  <option>Inglés</option>
                  <option>Francés</option>
                  <option>Portugués</option>
                </select>
              </label>
              <label className="field">
                <span>Agent Name</span>
                <input value={agentName} onChange={(e) => setAgentName(e.target.value)} />
              </label>
              <label className="field">
                <span>Agent Purpose</span>
                <div className="select-wrap">
                  <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                    <option>Atención al cliente</option>
                    <option>Soporte técnico</option>
                    <option>Ventas</option>
                    <option>Recursos humanos</option>
                  </select>
                  <ChevronDown size={14} className="select-icon" />
                </div>
              </label>
              <label className="field">
                <span>Company Name</span>
                <input value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
              <label className="field textarea-field">
                <span>Company Description</span>
                <textarea value={companyDesc} onChange={(e) => setCompanyDesc(e.target.value)} />
              </label>
            </div>
          )}

          {tab === 'Instructions' && (
            <div className="config-block">
              <label className="field textarea-field">
                <span>Instructions</span>
                <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} />
              </label>
              <div className="model-section">
                <label className="field">
                  <span>Model</span>
                  <div className="select-wrap">
                    <select value={model} onChange={(e) => setModel(e.target.value)}>
                      <option>GPT-4o</option>
                      <option>Claude 3.5</option>
                      <option>Gemini 1.5</option>
                    </select>
                    <ChevronDown size={14} className="select-icon" />
                  </div>
                </label>
                <label className="field">
                  <span>Temperature</span>
                  <div className="slider-row">
                    <input type="range" min="0" max="1" step="0.1" value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
                    <b>{temperature.toFixed(1)}</b>
                  </div>
                  <small>Valores bajos = respuestas más predecibles. Valores altos = respuestas más creativas.</small>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="knowledge-section">
          <h4>Conocimiento</h4>
          <p>Administra las fuentes de conocimiento que el agente usará como contexto.</p>
          <button className="secondary-button" onClick={() => onNotify('Carga de conocimiento iniciada')}><Paperclip size={14} /> Agregar fuente</button>
        </div>
      </div>
    </div>
  )
}