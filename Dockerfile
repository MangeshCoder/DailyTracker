# ─────────────────────────────────────────────────────────────────────────────
#  DailyTracker — one container that serves the web app AND the API
#  (same address → login cookies, live chat and uploads just work)
#
#  Used by Render (render.yaml). Local development does NOT use this file:
#  keep running  dotnet run  in api/  and  npm run dev  in ui/.
#
#  Try it locally (needs Docker):  docker build -t dailytracker .
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Build the web app (React) ─────────────────────────────────────────────
FROM node:22-alpine AS ui
WORKDIR /src/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY ui/ ./
# The API lives on the same address, under /api
ENV VITE_API_URL=/api
RUN npm run build

# ── 2. Build the API (.NET) ──────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY api/DailyTrackerAPI.csproj api/
RUN dotnet restore api/DailyTrackerAPI.csproj
COPY api/ api/
RUN dotnet publish api/DailyTrackerAPI.csproj -c Release -o /app --no-restore /p:UseAppHost=false

# ── 3. Run ───────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /app ./
COPY --from=ui /src/ui/dist ./wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=10000 \
    Hosting__BehindHttpsProxy=true \
    # small free server (512 MB): lighter garbage collector
    DOTNET_gcServer=0 \
    DOTNET_GCConserveMemory=5

EXPOSE 10000
USER $APP_UID
ENTRYPOINT ["dotnet", "DailyTrackerAPI.dll"]
