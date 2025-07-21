import React, { useEffect, useState } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const SOCKET_URL = 'https://registro-posibles-clientes.onrender.com';
const API_BASE_URL = 'https://registro-posibles-clientes.onrender.com/api/clientes';


const socket = io(SOCKET_URL);

const axiosConClave = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'x-api-key': 'salonfantasy'
  }
});

const App = () => {
  const [clientes, setClientes] = useState([]);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [orden, setOrden] = useState('');
  const [ordenAscendente, setOrdenAscendente] = useState(true);
  const [filtroEstatus, setFiltroEstatus] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [nuevoCliente, setNuevoCliente] = useState({
  nombre: '',
  fechaSolicitud: '',
  numeroPersonas: '',
  tipoEvento: '',
  plataforma: '',
  vendedora: '',
  estatus: 'pendiente',
  observaciones: '',
  telefono: ''
});

  const vendedoras = ["Julia", "Ariztbe", "Laura", "Guadalupe"];
  const plataformas = ["Facebook", "Instagram", "WhatsApp", "Recomendación"];
  const estatuses = ["pendiente", "en revisión", "descartado", "cerrado"];

  const obtenerClientes = async () => {
    try {
      const res = await axiosConClave.get('/');
      if (Array.isArray(res.data)) {
        setClientes(res.data);
      } else {
        console.warn('Respuesta inesperada:', res.data);
        setClientes([]);
      }
    } catch (error) {
      alert('Error al obtener clientes: ' + error.message);
      setClientes([]);
    }
  };

  useEffect(() => {
    obtenerClientes();
    socket.on('estatusActualizado', obtenerClientes);
    return () => socket.off('estatusActualizado');
  }, []);

  const handleChange = e => {
    setNuevoCliente({
      ...nuevoCliente,
      [e.target.name]: e.target.value
    });
  };

  const crearCliente = async () => {
    const camposObligatorios = [
      { campo: 'nombre', valor: nuevoCliente.nombre },
      { campo: 'fechaSolicitud', valor: nuevoCliente.fechaSolicitud },
      { campo: 'numeroPersonas', valor: nuevoCliente.numeroPersonas },
      { campo: 'tipoEvento', valor: nuevoCliente.tipoEvento },
      { campo: 'plataforma', valor: nuevoCliente.plataforma },
      { campo: 'vendedora', valor: nuevoCliente.vendedora },
      { campo: 'estatus', valor: nuevoCliente.estatus },
      { campo: 'observaciones', valor: nuevoCliente.observaciones }
    ];

    const campoVacio = camposObligatorios.find(c => String(c.valor).trim() === '');
    if (campoVacio) {
      alert(`El campo "${campoVacio.campo}" es obligatorio.`);
      return;
    }

    try {
      if (editandoId) {
        await axiosConClave.put(`/${editandoId}`, nuevoCliente);
      } else {
        await axiosConClave.post('/', nuevoCliente);
      }
      obtenerClientes();
      setNuevoCliente({
     nombre: '',
     fechaSolicitud: '',
   numeroPersonas: '',
  tipoEvento: '',
  plataforma: '',
  vendedora: '',
  estatus: 'pendiente',
  observaciones: '',
  telefono: '' 
});
      setEditandoId(null);
    } catch (err) {
      alert('Error al crear o editar cliente: ' + (err.response?.data?.error || err.message));
    }
  };

  const editarCliente = cliente => {
    setNuevoCliente(cliente);
    setEditandoId(cliente._id);
    window.scrollTo(0, 0);
  };

  const cambiarEstatus = async (id, estatus) => {
    try {
      await axiosConClave.put(`/estatus/${id}`, { estatus });
      socket.emit('actualizarEstatus');
    } catch (error) {
      alert('Error al actualizar estatus: ' + error.message);
    }
  };

  const eliminarCliente = async (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este cliente?")) {
      try {
        await axiosConClave.delete(`/${id}`);
        obtenerClientes();
      } catch (error) {
        alert('Error al eliminar cliente: ' + error.message);
      }
    }
  };

  const colorPorEstatus = estatus => {
    const colores = {
      pendiente: '#ff9800',
      'en revisión': '#ffc107',
      descartado: '#f44336',
      cerrado: '#4caf50'
    };
    return colores[estatus] || 'gray';
  };

  const filtrarClientes = () => {
    if (!Array.isArray(clientes)) return [];

    let filtrados = clientes.filter(c =>
      Object.values(c).some(val =>
        val?.toString().toLowerCase().includes(filtroBusqueda.toLowerCase())
      ) &&
      (filtroEstatus === '' || c.estatus === filtroEstatus)
    );

    if (orden === 'nombre') {
      filtrados.sort((a, b) =>
        ordenAscendente ? a.nombre.localeCompare(b.nombre) : b.nombre.localeCompare(a.nombre)
      );
    } else if (orden === 'fecha') {
      filtrados.sort((a, b) =>
        ordenAscendente ? new Date(a.fechaSolicitud) - new Date(b.fechaSolicitud)
                        : new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud)
      );
    } else if (orden === 'personas') {
      filtrados.sort((a, b) =>
        ordenAscendente ? a.numeroPersonas - b.numeroPersonas : b.numeroPersonas - a.numeroPersonas
      );
    }

    return filtrados;
  };

  const exportarExcel = () => {
    const datos = filtrarClientes().map(c => ({
      Nombre: c.nombre,
      Fecha: new Date(c.fechaSolicitud).toLocaleDateString(),
      Personas: c.numeroPersonas,
      TipoEvento: c.tipoEvento,
      Plataforma: c.plataforma,
      Vendedora: c.vendedora,
      Estatus: c.estatus,
      Observaciones: c.observaciones
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const archivo = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(archivo, 'clientes.xlsx');
  };

  const inputStyle = {
    padding: '10px',
    margin: '5px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    width: '200px'
  };

  const sectionStyle = {
    backgroundColor: '#f8f9fa',
    padding: '20px',
    marginBottom: '30px',
    borderRadius: '10px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
  };

  const clienteStyle = {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '10px',
    padding: '15px',
    marginBottom: '15px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', backgroundColor: '#eef2f5', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Registro y Seguimiento de Clientes</h1>

      {/* Formulario */}
      <div style={sectionStyle}>
        <h2>{editandoId ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
        <input style={inputStyle} name="nombre" value={nuevoCliente.nombre} onChange={handleChange} placeholder="Nombre" />
        <input style={inputStyle} type="date" name="fechaSolicitud" value={nuevoCliente.fechaSolicitud?.substring(0,10) || ''} onChange={handleChange} />
        <input style={inputStyle} type="number" name="numeroPersonas" value={nuevoCliente.numeroPersonas} onChange={handleChange} placeholder="Número de personas" />
        <input style={inputStyle} name="tipoEvento" value={nuevoCliente.tipoEvento} onChange={handleChange} placeholder="Tipo de evento" />
        <select style={inputStyle} name="plataforma" value={nuevoCliente.plataforma} onChange={handleChange}>
          <option value="">Plataforma</option>
          {plataformas.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select style={inputStyle} name="vendedora" value={nuevoCliente.vendedora} onChange={handleChange}>
          <option value="">Vendedora</option>
          {vendedoras.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select style={inputStyle} name="estatus" value={nuevoCliente.estatus} onChange={handleChange}>
          {estatuses.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <input style={{ ...inputStyle, width: '100%' }} name="observaciones" value={nuevoCliente.observaciones} onChange={handleChange} placeholder="Observaciones" />
        <br />
        <input style={{ ...inputStyle, width: '100%' }} name="telefono" value={nuevoCliente.telefono} onChange={handleChange} placeholder="Teléfono"/>
        <button onClick={crearCliente} style={{ ...inputStyle, cursor: 'pointer', backgroundColor: '#007bff', color: '#fff', width: '220px' }}>{editandoId ? 'Actualizar' : 'Agregar'} cliente</button>
      </div>

      {/* Filtros */}
      <div style={sectionStyle}>
        <h2>Buscar y Ordenar</h2>
        <input style={inputStyle} placeholder="Buscar..." value={filtroBusqueda} onChange={e => setFiltroBusqueda(e.target.value)} />
        <select style={inputStyle} value={orden} onChange={e => setOrden(e.target.value)}>
          <option value="">Ordenar por</option>
          <option value="nombre">Nombre</option>
          <option value="fecha">Fecha</option>
          <option value="personas">Número de personas</option>
        </select>
        <select value={ordenAscendente ? 'asc' : 'desc'} onChange={(e) => setOrdenAscendente(e.target.value === 'asc')} style={{ ...inputStyle, width: '200px' }}>
          <option value="asc">Orden Ascendente</option>
          <option value="desc">Orden Descendente</option>
        </select>
        <select style={inputStyle} value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value)}>
          <option value="">Todos los estatus</option>
          {estatuses.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <button onClick={exportarExcel} style={{ ...inputStyle, backgroundColor: '#28a745', color: 'white', cursor: 'pointer' }}>Exportar a Excel</button>
      </div>

      {/* Lista */}
      <div style={sectionStyle}>
        <h2>Clientes Registrados</h2>
        {filtrarClientes().map(cliente => (
          <div key={cliente._id} style={clienteStyle}>
            <p><strong>Nombre:</strong> {cliente.nombre}</p>
            <p><strong>Fecha:</strong> {new Date(cliente.fechaSolicitud).toLocaleDateString()}</p>
            <p><strong>Personas:</strong> {cliente.numeroPersonas}</p>
            <p><strong>Tipo:</strong> {cliente.tipoEvento}</p>
            <p><strong>Plataforma:</strong> {cliente.plataforma}</p>
            <p><strong>Vendedora:</strong> {cliente.vendedora}</p>
            <p><strong>Observaciones:</strong> {cliente.observaciones}</p>
            <p><strong>Teléfono:</strong> {cliente.telefono}</p>
            <p>
              <strong>Estatus:</strong>{' '}
              <span style={{ color: colorPorEstatus(cliente.estatus), fontWeight: 'bold' }}>
                {cliente.estatus}
              </span>
            </p>
            <select style={{ ...inputStyle, width: '100%' }} onChange={e => cambiarEstatus(cliente._id, e.target.value)} defaultValue="">
              <option disabled value="">Cambiar estatus</option>
              {estatuses.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => editarCliente(cliente)} style={{ ...inputStyle, backgroundColor: '#ffc107', color: 'black', width: '100%' }}>Editar</button>
              <button onClick={() => eliminarCliente(cliente._id)} style={{ ...inputStyle, backgroundColor: '#dc3545', color: 'white', width: '100%' }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
