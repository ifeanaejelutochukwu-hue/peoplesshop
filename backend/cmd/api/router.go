package main

import (
	"net/http"
	"strings"
	"time"

	"github.com/Peoplesshop/backend/internal/auth"
	"github.com/Peoplesshop/backend/internal/handler"
	mw "github.com/Peoplesshop/backend/internal/middleware"
	"github.com/Peoplesshop/backend/internal/repository"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
)

type Handlers struct {
	auth        *handler.AuthHandler
	user        *handler.UserHandler
	settings    *handler.SettingsHandler
	audit       *handler.AuditHandler
	dashboard   *handler.DashboardHandler
	category    *handler.CategoryHandler
	product     *handler.ProductHandler
	inventory   *handler.InventoryHandler
	adjustment  *handler.AdjustmentHandler
	supplier    *handler.SupplierHandler
	purchase    *handler.PurchaseHandler
	sale        *handler.SaleHandler
	customer    *handler.CustomerHandler
	expense     *handler.ExpenseHandler
	report      *handler.ReportHandler
}

func buildRouter(
	h Handlers,
	jwtSvc *auth.JWTService,
	userRepo *repository.UserRepository,
	corsOrigins string,
) http.Handler {
	r := chi.NewRouter()

	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(60 * time.Second))
	r.Use(chimiddleware.Compress(5))

	origins := strings.Split(corsOrigins, ",")
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		handler.WriteSuccess(w, map[string]string{"status": "ok", "service": "peoplesshop-api"})
	})

	r.Route("/api/v1", func(r chi.Router) {

		// ---- Public (rate-limited) ----
		r.Group(func(r chi.Router) {
			r.Use(httprate.LimitByIP(20, 1*time.Minute))
			r.Post("/auth/login", h.auth.Login)
			r.Post("/auth/refresh", h.auth.Refresh)
		})

		// ---- Protected ----
		r.Group(func(r chi.Router) {
			r.Use(mw.Authenticate(jwtSvc))

			// Auth
			r.Post("/auth/logout", h.auth.Logout)
			r.Get("/auth/me", h.auth.Me)

			// Dashboard
			r.With(mw.RequirePermission("dashboard:view", userRepo)).
				Get("/dashboard", h.dashboard.Get)

			// Settings
			r.Get("/settings", h.settings.Get)
			r.With(mw.RequirePermission("settings:manage", userRepo)).Put("/settings", h.settings.Update)

			// Roles
			r.Get("/roles", h.user.ListRoles)

			// Staff
			r.Route("/staff", func(r chi.Router) {
				r.Use(mw.RequirePermission("staff:view", userRepo))
				r.Get("/", h.user.List)
				r.With(mw.RequirePermission("staff:manage", userRepo)).Post("/", h.user.Create)
				r.With(mw.RequirePermission("staff:manage", userRepo)).Patch("/{id}/status", h.user.SetActive)
				r.With(mw.RequirePermission("staff:manage", userRepo)).Post("/{id}/reset-password", h.user.ResetPassword)
			})

			// Audit logs
			r.With(mw.RequirePermission("audit:view", userRepo)).Get("/audit-logs", h.audit.List)

			// Categories
			r.Route("/categories", func(r chi.Router) {
				r.Get("/", h.category.List)
				r.With(mw.RequirePermission("categories:manage", userRepo)).Post("/", h.category.Create)
				r.With(mw.RequirePermission("categories:manage", userRepo)).Put("/{id}", h.category.Update)
				r.With(mw.RequirePermission("categories:manage", userRepo)).Delete("/{id}", h.category.Delete)
			})

			// Products
			r.Route("/products", func(r chi.Router) {
				r.With(mw.RequirePermission("products:view", userRepo)).Get("/", h.product.List)
				r.With(mw.RequirePermission("products:view", userRepo)).Get("/{id}", h.product.Get)
				r.With(mw.RequirePermission("products:create", userRepo)).Post("/", h.product.Create)
				r.With(mw.RequirePermission("products:edit", userRepo)).Put("/{id}", h.product.Update)
				r.With(mw.RequirePermission("products:delete", userRepo)).Delete("/{id}", h.product.Archive)
				r.With(mw.RequirePermission("variants:manage", userRepo)).Post("/{id}/variants", h.product.AddVariant)
			})

			// Variants
			r.Route("/variants", func(r chi.Router) {
				r.With(mw.RequirePermission("products:view", userRepo)).Get("/{id}", h.product.GetVariant)
				r.With(mw.RequirePermission("variants:manage", userRepo)).Put("/{id}", h.product.UpdateVariant)
				r.With(mw.RequirePermission("products:delete", userRepo)).Delete("/{id}", h.product.DeleteVariant)
			})

			// Inventory
			r.Route("/inventory", func(r chi.Router) {
				r.Use(mw.RequirePermission("inventory:view", userRepo))
				r.Get("/", h.inventory.GetOverview)
				r.Get("/movements", h.inventory.ListMovements)
				r.With(mw.RequirePermission("inventory:adjust", userRepo)).Get("/adjustments", h.adjustment.List)
				r.With(mw.RequirePermission("inventory:adjust", userRepo)).Post("/adjustments", h.adjustment.Create)
			})

			// Suppliers
			r.Route("/suppliers", func(r chi.Router) {
				r.Use(mw.RequirePermission("suppliers:view", userRepo))
				r.Get("/", h.supplier.List)
				r.Get("/{id}", h.supplier.Get)
				r.With(mw.RequirePermission("suppliers:manage", userRepo)).Post("/", h.supplier.Create)
				r.With(mw.RequirePermission("suppliers:manage", userRepo)).Put("/{id}", h.supplier.Update)
			})

			// Purchases
			r.Route("/purchases", func(r chi.Router) {
				r.Use(mw.RequirePermission("purchases:view", userRepo))
				r.Get("/", h.purchase.List)
				r.Get("/{id}", h.purchase.Get)
				r.With(mw.RequirePermission("purchases:create", userRepo)).Post("/", h.purchase.Create)
				r.With(mw.RequirePermission("purchases:receive", userRepo)).Post("/{id}/receive", h.purchase.ReceiveStock)
			})

			// Sales
			r.Route("/sales", func(r chi.Router) {
				r.Get("/", h.sale.List)
				r.Get("/{id}", h.sale.Get)
				r.With(mw.RequirePermission("pos:access", userRepo)).Post("/", h.sale.Create)
				r.With(mw.RequirePermission("sales:reverse", userRepo)).Post("/{id}/reverse", h.sale.Reverse)
			})

			// Customers
			r.Route("/customers", func(r chi.Router) {
				r.Use(mw.RequirePermission("customers:view", userRepo))
				r.Get("/", h.customer.List)
				r.Get("/{id}", h.customer.Get)
				r.With(mw.RequirePermission("customers:manage", userRepo)).Post("/", h.customer.Create)
				r.With(mw.RequirePermission("customers:manage", userRepo)).Put("/{id}", h.customer.Update)
			})

			// Expenses
			r.Route("/expenses", func(r chi.Router) {
				r.Use(mw.RequirePermission("expenses:view", userRepo))
				r.Get("/categories", h.expense.ListCategories)
				r.Get("/", h.expense.List)
				r.With(mw.RequirePermission("expenses:manage", userRepo)).Post("/", h.expense.Create)
				r.With(mw.RequirePermission("expenses:manage", userRepo)).Delete("/{id}", h.expense.Delete)
			})

			// Reports
			r.Route("/reports", func(r chi.Router) {
				r.With(mw.RequirePermission("reports:sales", userRepo)).Get("/sales", h.report.GetSalesReport)
				r.With(mw.RequirePermission("reports:financial", userRepo)).Get("/profit", h.report.GetProfitReport)
				r.With(mw.RequirePermission("reports:inventory", userRepo)).Get("/inventory", h.report.GetInventoryReport)
				r.With(mw.RequirePermission("reports:sales", userRepo)).Get("/products", h.report.GetProductPerformance)
			})
		})
	})

	return r
}
