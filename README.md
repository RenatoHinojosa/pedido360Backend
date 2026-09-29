# Pedidos360 - Backend Serverless

Backend de los módulos **Catálogo** y **Órdenes** del caso Pedidos360, desplegado como Infrastructure as Code con **Serverless Framework**.

## Stack
- AWS Lambda (Node.js 20.x)
- API Gateway HTTP API + JWT Authorizer (Microsoft Entra ID)
- DynamoDB (tablas `Productos` y `Ordenes`, con sus índices)

## Requisitos previos
- Node.js 20+
- Una cuenta de AWS Academy Learner Lab activa (o cualquier cuenta AWS con el rol `LabRole` disponible)
- El App Registration del backend ya creado en Entra ID

## 1. Instalación

```bash
npm install
```

## 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Rellena `.env` con:
- Las credenciales del Lab (botón **AWS Details → Show** en el Learner Lab)
- `AWS_ROLE_ARN`: el ARN del `LabRole` (aparece también en AWS Details)
- `AZURE_API_AUDIENCE`: el Client ID de tu App Registration del backend (sin `api://`)
- `AZURE_TENANT_ID`: el Tenant ID de tu Entra ID

⚠️ **Las credenciales del Lab expiran** (unas horas). Si el deploy falla con un error de autenticación/expiración, vuelve a copiar credenciales frescas desde el Lab.

## 3. Desplegar

```bash
npm run deploy
```

Esto crea (o actualiza) en tu cuenta de AWS:
- Las tablas `Productos-dev` y `Ordenes-dev` con sus índices
- Las 8 funciones Lambda
- El API Gateway HTTP API con todas las rutas
- El JWT Authorizer conectado a tu tenant de Entra ID

Al terminar, la terminal muestra la URL base del API (algo como `https://xxxxx.execute-api.us-east-1.amazonaws.com`) — esa es la que va en `VITE_API_BASE_URL` del frontend.

## 4. Verificar

```bash
npx serverless info --stage dev
```

Lista todas las rutas desplegadas y sus endpoints.

## 5. Ver logs de una función

```bash
npx serverless logs -f crearProducto --stage dev -t
```

## 6. Eliminar todo (limpiar la cuenta)

```bash
npm run remove
```

## Despliegue automático vía GitHub Actions

Ver `.github/workflows/deploy.yml`. Se dispara en cada `push` a `main` y usa las mismas variables, leídas desde **GitHub Secrets** en vez del `.env` local (Settings → Secrets and variables → Actions).

Secrets a configurar en el repo:
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_ACCOUNT_ID`, `AWS_REGION`, `AWS_ROLE_ARN`, `AZURE_API_AUDIENCE`, `AZURE_TENANT_ID`

⚠️ Como las credenciales del Lab expiran, este workflow solo va a funcionar mientras el Lab esté activo con credenciales vigentes en los Secrets — hay que actualizarlos ahí también cuando caduquen.
