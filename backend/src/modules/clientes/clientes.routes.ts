import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requirePropietarioContext, requireRoles } from '../../middlewares/roles.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createClienteController,
  deleteClienteController,
  getClienteController,
  listClientesController,
  updateClienteController,
  updateEstadoClienteController
} from './clientes.controller.js';
import { clienteCreateSchema, clienteEstadoSchema, clienteUpdateSchema } from './clientes.schema.js';

export const clientesRouter = Router();

const canReadClientes = requireRoles('admin', 'operador', 'supervisor', 'consulta');
const canWriteClientes = requireRoles('admin', 'operador');

clientesRouter.use(authMiddleware, requirePropietarioContext);

clientesRouter.get('/', canReadClientes, listClientesController);
clientesRouter.post('/', canWriteClientes, validateBody(clienteCreateSchema), createClienteController);
clientesRouter.get('/:id', canReadClientes, getClienteController);
clientesRouter.put('/:id', canWriteClientes, validateBody(clienteUpdateSchema), updateClienteController);
clientesRouter.patch(
  '/:id/estado',
  canWriteClientes,
  validateBody(clienteEstadoSchema),
  updateEstadoClienteController
);
clientesRouter.delete('/:id', canWriteClientes, deleteClienteController);
