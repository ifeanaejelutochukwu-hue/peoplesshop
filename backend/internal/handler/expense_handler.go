package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/Peoplesshop/backend/internal/middleware"
	"github.com/Peoplesshop/backend/internal/model"
	"github.com/Peoplesshop/backend/internal/repository"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type ExpenseHandler struct {
	expenseRepo *repository.ExpenseRepository
}

func NewExpenseHandler(repo *repository.ExpenseRepository) *ExpenseHandler {
	return &ExpenseHandler{expenseRepo: repo}
}

func (h *ExpenseHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	cats, err := h.expenseRepo.ListCategories(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list categories")
		return
	}
	WriteSuccess(w, cats)
}

func (h *ExpenseHandler) List(w http.ResponseWriter, r *http.Request) {
	page, pageSize := PaginationParams(r)
	offset := Offset(page, pageSize)

	var catID *int
	if s := r.URL.Query().Get("category_id"); s != "" {
		if n, err := strconv.Atoi(s); err == nil {
			catID = &n
		}
	}

	expenses, total, err := h.expenseRepo.List(r.Context(), pageSize, offset, catID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list expenses")
		return
	}
	WritePaginated(w, expenses, total, page, pageSize)
}

func (h *ExpenseHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ExpenseCategoryID int    `json:"expense_category_id"`
		Description       string `json:"description"`
		AmountKobo        int64  `json:"amount_kobo"`
		ExpenseDate       string `json:"expense_date"` // YYYY-MM-DD
		PaymentMethod     string `json:"payment_method"`
		Notes             string `json:"notes"`
	}
	if !DecodeJSON(w, r, &body) {
		return
	}
	if body.Description == "" || body.AmountKobo <= 0 {
		WriteError(w, http.StatusBadRequest, "description and amount are required")
		return
	}

	userIDStr, _ := r.Context().Value(middleware.ContextKeyUserID).(string)
	recordedBy, _ := uuid.Parse(userIDStr)

	expDate := time.Now()
	if body.ExpenseDate != "" {
		if t, err := time.Parse("2006-01-02", body.ExpenseDate); err == nil {
			expDate = t
		}
	}

	e := &model.Expense{
		ID:                uuid.New(),
		ExpenseCategoryID: body.ExpenseCategoryID,
		Description:       body.Description,
		AmountKobo:        body.AmountKobo,
		ExpenseDate:       expDate,
		RecordedBy:        recordedBy,
	}
	if body.PaymentMethod != "" {
		e.PaymentMethod = &body.PaymentMethod
	}
	if body.Notes != "" {
		e.Notes = &body.Notes
	}

	if err := h.expenseRepo.Create(r.Context(), e); err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to create expense")
		return
	}
	WriteCreated(w, e)
}

func (h *ExpenseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid expense id")
		return
	}
	if err := h.expenseRepo.Delete(r.Context(), id); err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to delete expense")
		return
	}
	WriteSuccess(w, map[string]string{"message": "expense deleted"})
}
