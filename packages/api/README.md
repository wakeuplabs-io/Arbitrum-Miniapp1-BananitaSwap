# API Package

Backend API built with Hono and Neon database.

## Setup

1. Install dependencies:
```bash
npm install
```

2. **Configurar variables de entorno (REQUERIDO):**
   
   La aplicación requiere configurar `DATABASE_URL` antes de iniciar.
   
```bash
# 1. Revisa las opciones disponibles
cat env.example

# 2. Crea .env.local con tu DATABASE_URL de Neon (REQUERIDO)
echo "DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require" > .env.local
```

   **Cómo obtener tu DATABASE_URL:**
   - Crea una cuenta gratuita en [Neon](https://neon.tech)
   - Crea un nuevo proyecto
   - Copia la connection string desde el dashboard
   
3. **Generar y ejecutar migraciones:**

```bash
npm run db:generate
npm run db:migrate
```

**Nota:** La aplicación NO iniciará sin una DATABASE_URL válida. Asegúrate de configurarla en `.env.local` antes de ejecutar `npm run dev`.

## Development

Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Testing

Run tests:
```bash
npm test
```

Run tests with UI:
```bash
npm run test:ui
```

## Database

This package uses Drizzle ORM with Neon PostgreSQL.

- `npm run db:generate` - Generate migrations from schema
- `npm run db:migrate` - Run migrations
- `npm run db:push` - Push schema changes directly
- `npm run db:studio` - Open Drizzle Studio

## Endpoints

- `GET /health` - Health check endpoint

