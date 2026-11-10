package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/Peoplesshop/backend/internal/auth"
	"github.com/Peoplesshop/backend/internal/config"
	"github.com/Peoplesshop/backend/internal/db"
	"github.com/Peoplesshop/backend/internal/handler"
	"github.com/Peoplesshop/backend/internal/repository"
	"github.com/Peoplesshop/backend/internal/service"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	pool, err := db.NewPool(cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("database connection established")

	if err := db.RunMigrations(cfg.DatabaseURL, filepath.Join("migrations")); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	if err := os.MkdirAll(cfg.UploadDir, 0750); err != nil {
		slog.Error("failed to create upload directory", "error", err)
		os.Exit(1)
	}

	// ---- JWT ----
	jwtSvc := auth.NewJWTService(
		cfg.JWTAccessSecret, cfg.JWTRefreshSecret,
		cfg.JWTAccessExpiry, cfg.JWTRefreshExpiry,
	)

	// ---- Repositories ----
	userRepo     := repository.NewUserRepository(pool)
	settingsRepo := repository.NewSettingsRepository(pool)
	auditRepo    := repository.NewAuditRepository(pool)
	catRepo      := repository.NewCategoryRepository(pool)
	productRepo  := repository.NewProductRepository(pool)
	variantRepo  := repository.NewVariantRepository(pool)
	invRepo      := repository.NewInventoryRepository(pool)
	adjRepo      := repository.NewAdjustmentRepository(pool)
	dashRepo     := repository.NewDashboardRepository(pool)
	supplierRepo := repository.NewSupplierRepository(pool)
	purchaseRepo := repository.NewPurchaseRepository(pool)
	saleRepo     := repository.NewSaleRepository(pool)
	customerRepo := repository.NewCustomerRepository(pool)
	expenseRepo  := repository.NewExpenseRepository(pool)
	reportRepo   := repository.NewReportRepository(pool)

	// ---- Services ----
	authSvc     := service.NewAuthService(userRepo, jwtSvc)
	userSvc     := service.NewUserService(userRepo)
	productSvc  := service.NewProductService(productRepo, variantRepo, settingsRepo)
	purchaseSvc := service.NewPurchaseService(purchaseRepo, variantRepo, invRepo)
	saleSvc     := service.NewSaleService(saleRepo, variantRepo, invRepo)

	// ---- Handlers ----
	handlers := Handlers{
		auth:       handler.NewAuthHandler(authSvc),
		user:       handler.NewUserHandler(userSvc),
		settings:   handler.NewSettingsHandler(settingsRepo),
		audit:      handler.NewAuditHandler(auditRepo),
		dashboard:  handler.NewDashboardHandler(dashRepo, saleRepo, invRepo),
		category:   handler.NewCategoryHandler(catRepo),
		product:    handler.NewProductHandler(productSvc, productRepo, variantRepo),
		inventory:  handler.NewInventoryHandler(invRepo),
		adjustment: handler.NewAdjustmentHandler(adjRepo, variantRepo, invRepo),
		supplier:   handler.NewSupplierHandler(supplierRepo),
		purchase:   handler.NewPurchaseHandler(purchaseSvc, purchaseRepo),
		sale:       handler.NewSaleHandler(saleSvc, saleRepo),
		customer:   handler.NewCustomerHandler(customerRepo, saleRepo),
		expense:    handler.NewExpenseHandler(expenseRepo),
		report:     handler.NewReportHandler(reportRepo),
	}

	router := buildRouter(handlers, jwtSvc, userRepo, cfg.CORSAllowedOrigins)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.AppPort),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	serverErrors := make(chan error, 1)
	go func() {
		slog.Info("Peoplesshop API starting", "port", cfg.AppPort, "env", cfg.AppEnv)
		serverErrors <- srv.ListenAndServe()
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-serverErrors:
		slog.Error("server error", "error", err)
		os.Exit(1)
	case sig := <-quit:
		slog.Info("shutdown signal", "signal", sig)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("graceful shutdown failed", "error", err)
		os.Exit(1)
	}
	slog.Info("server stopped cleanly")
}
