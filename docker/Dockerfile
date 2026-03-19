# ── Stage 1: Build React UI ──────────────────────────────────────────────────
FROM node:22-alpine AS ui-build
WORKDIR /ui
COPY src/kaselog-ui/package*.json ./
RUN npm ci
COPY src/kaselog-ui/ .
# Override outDir so the output lands in /ui/dist regardless of vite.config.ts
RUN npx vite build --outDir /dist

# ── Stage 2: Build .NET API ───────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS api-build
WORKDIR /build
COPY KaseLog.sln .
COPY src/KaseLog.Api/ src/KaseLog.Api/
COPY tests/KaseLog.Api.Tests/ tests/KaseLog.Api.Tests/
RUN dotnet restore
# Inject the React build into the API's wwwroot before publish
COPY --from=ui-build /dist ./src/KaseLog.Api/wwwroot/
RUN dotnet publish src/KaseLog.Api/KaseLog.Api.csproj -c Release -o /app --no-restore

# ── Stage 3: Runtime image ────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=api-build /app .

VOLUME /data

ENV KASELOG_PORT=5000
ENV KASELOG_DB_PROVIDER=sqlite
ENV KASELOG_DATA_PATH=/data/kaselog.db
ENV KASELOG_CONNECTION_STRING=

EXPOSE 5000
ENTRYPOINT ["dotnet", "KaseLog.Api.dll"]
