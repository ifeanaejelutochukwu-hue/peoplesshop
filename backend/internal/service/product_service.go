package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Peoplesshop/backend/internal/model"
	"github.com/Peoplesshop/backend/internal/repository"
	"github.com/google/uuid"
)

type ProductService struct {
	productRepo  *repository.ProductRepository
	variantRepo  *repository.VariantRepository
	settingsRepo *repository.SettingsRepository
}

func NewProductService(
	productRepo *repository.ProductRepository,
	variantRepo *repository.VariantRepository,
	settingsRepo *repository.SettingsRepository,
) *ProductService {
	return &ProductService{
		productRepo:  productRepo,
		variantRepo:  variantRepo,
		settingsRepo: settingsRepo,
	}
}

type CreateProductRequest struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	CategoryID  *int       `json:"category_id"`
	Brand       string     `json:"brand"`
	ImageURL    string     `json:"image_url"`
	SupplierID  *uuid.UUID `json:"supplier_id"`
}

type CreateVariantRequest struct {
	Size               string  `json:"size"`
	Colour             string  `json:"colour"`
	SKU                string  `json:"sku"`           // optional — auto-generated if blank
	Barcode            string  `json:"barcode"`
	SellingPriceKobo   int64   `json:"selling_price_kobo"`
	CostPriceKobo      int64   `json:"cost_price_kobo"`
	InitialStock       int     `json:"initial_stock"`
	LowStockThreshold  int     `json:"low_stock_threshold"`
}

type UpdateVariantRequest struct {
	Size               string  `json:"size"`
	Colour             string  `json:"colour"`
	SKU                string  `json:"sku"`
	Barcode            string  `json:"barcode"`
	SellingPriceKobo   int64   `json:"selling_price_kobo"`
	CostPriceKobo      int64   `json:"cost_price_kobo"`
	LowStockThreshold  int     `json:"low_stock_threshold"`
	IsActive           bool    `json:"is_active"`
}

// CreateProduct creates a new product without variants.
func (s *ProductService) CreateProduct(ctx context.Context, req CreateProductRequest, createdBy uuid.UUID) (*model.Product, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, errors.New("product name is required")
	}

	p := &model.Product{
		ID:       uuid.New(),
		Name:     req.Name,
		Brand:    &req.Brand,
		IsActive: true,
	}
	if req.Description != "" {
		p.Description = &req.Description
	}
	if req.CategoryID != nil {
		p.CategoryID = req.CategoryID
	}
	if req.ImageURL != "" {
		p.ImageURL = &req.ImageURL
	}
	if req.SupplierID != nil {
		p.SupplierID = req.SupplierID
	}

	if err := s.productRepo.Create(ctx, p, createdBy); err != nil {
		return nil, fmt.Errorf("create product: %w", err)
	}
	return p, nil
}

// AddVariant adds a variant to an existing product.
func (s *ProductService) AddVariant(ctx context.Context, productID uuid.UUID, req CreateVariantRequest) (*model.ProductVariant, error) {
	settings, err := s.settingsRepo.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("get settings: %w", err)
	}

	sku := req.SKU
	if sku == "" {
		sku = s.generateSKU(settings.SKUPrefix, productID, req.Size, req.Colour)
	} else {
		// Check for uniqueness
		exists, err := s.variantRepo.SKUExists(ctx, sku, nil)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, fmt.Errorf("SKU '%s' is already in use", sku)
		}
	}

	if req.LowStockThreshold == 0 {
		req.LowStockThreshold = settings.DefaultLowStockThreshold
	}

	v := &model.ProductVariant{
		ID:                uuid.New(),
		ProductID:         productID,
		SKU:               sku,
		SellingPriceKobo:  req.SellingPriceKobo,
		CostPriceKobo:     req.CostPriceKobo,
		StockQuantity:     req.InitialStock,
		LowStockThreshold: req.LowStockThreshold,
		IsActive:          true,
	}
	if req.Size != "" {
		v.Size = &req.Size
	}
	if req.Colour != "" {
		v.Colour = &req.Colour
	}
	if req.Barcode != "" {
		v.Barcode = &req.Barcode
	}

	if err := s.variantRepo.Create(ctx, v); err != nil {
		return nil, fmt.Errorf("create variant: %w", err)
	}
	v.StockStatus = v.ComputeStockStatus()
	return v, nil
}

// UpdateVariant modifies a variant's attributes.
func (s *ProductService) UpdateVariant(ctx context.Context, variantID uuid.UUID, req UpdateVariantRequest) (*model.ProductVariant, error) {
	v, err := s.variantRepo.GetByID(ctx, variantID)
	if err != nil {
		return nil, err
	}

	if req.SKU != v.SKU {
		exists, err := s.variantRepo.SKUExists(ctx, req.SKU, &variantID)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, fmt.Errorf("SKU '%s' is already in use", req.SKU)
		}
	}

	v.SKU = req.SKU
	v.SellingPriceKobo = req.SellingPriceKobo
	v.CostPriceKobo = req.CostPriceKobo
	v.LowStockThreshold = req.LowStockThreshold
	v.IsActive = req.IsActive
	if req.Size != "" {
		v.Size = &req.Size
	}
	if req.Colour != "" {
		v.Colour = &req.Colour
	}
	if req.Barcode != "" {
		v.Barcode = &req.Barcode
	}

	if err := s.variantRepo.Update(ctx, v); err != nil {
		return nil, err
	}
	v.StockStatus = v.ComputeStockStatus()
	return v, nil
}

// generateSKU creates a SKU from prefix + product ID fragment + variant attributes.
func (s *ProductService) generateSKU(prefix string, productID uuid.UUID, size, colour string) string {
	idPart := strings.ToUpper(productID.String()[:6])
	parts := []string{prefix, idPart}
	if size != "" {
		parts = append(parts, strings.ToUpper(strings.ReplaceAll(size, " ", "")))
	}
	if colour != "" {
		words := strings.Fields(colour)
		colourCode := ""
		for _, w := range words {
			if len(w) > 0 {
				colourCode += strings.ToUpper(string(w[0]))
			}
		}
		parts = append(parts, colourCode)
	}
	ts := fmt.Sprintf("%d", time.Now().UnixMilli()%10000)
	parts = append(parts, ts)
	return strings.Join(parts, "-")
}
