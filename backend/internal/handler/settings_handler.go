package handler

import (
	"net/http"

	"github.com/Peoplesshop/backend/internal/model"
	"github.com/Peoplesshop/backend/internal/repository"
)

type SettingsHandler struct {
	settingsRepo *repository.SettingsRepository
}

func NewSettingsHandler(settingsRepo *repository.SettingsRepository) *SettingsHandler {
	return &SettingsHandler{settingsRepo: settingsRepo}
}

// Get GET /api/v1/settings
func (h *SettingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	s, err := h.settingsRepo.Get(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to load settings")
		return
	}
	WriteSuccess(w, s)
}

// Update PUT /api/v1/settings
func (h *SettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	existing, err := h.settingsRepo.Get(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to load settings")
		return
	}

	var input model.BusinessSettings
	if !DecodeJSON(w, r, &input) {
		return
	}

	// Preserve ID
	input.ID = existing.ID

	if err := h.settingsRepo.Update(r.Context(), &input); err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to update settings")
		return
	}

	WriteSuccess(w, map[string]string{"message": "settings updated"})
}
