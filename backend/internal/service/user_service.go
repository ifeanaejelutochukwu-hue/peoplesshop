package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/Peoplesshop/backend/internal/auth"
	"github.com/Peoplesshop/backend/internal/model"
	"github.com/Peoplesshop/backend/internal/repository"
	"github.com/google/uuid"
)

type UserService struct {
	userRepo *repository.UserRepository
}

func NewUserService(userRepo *repository.UserRepository) *UserService {
	return &UserService{userRepo: userRepo}
}

type CreateUserRequest struct {
	FullName string `json:"full_name"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	RoleName string `json:"role_name"`
}

// Create creates a new user account.
func (s *UserService) Create(ctx context.Context, req CreateUserRequest) (*model.User, error) {
	if req.FullName == "" || req.Username == "" || req.Password == "" || req.RoleName == "" {
		return nil, errors.New("full_name, username, password and role_name are required")
	}
	if len(req.Password) < 8 {
		return nil, errors.New("password must be at least 8 characters")
	}

	role, err := s.userRepo.GetRoleByName(ctx, req.RoleName)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("role '%s' not found", req.RoleName)
		}
		return nil, err
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	u := &model.User{
		ID:       uuid.New(),
		FullName: req.FullName,
		Username: req.Username,
		Role:     *role,
		RoleID:   role.ID,
		IsActive: true,
	}
	if req.Email != "" {
		u.Email = &req.Email
	}

	if err := s.userRepo.Create(ctx, u, hash); err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return u, nil
}

// List returns paginated users.
func (s *UserService) List(ctx context.Context, page, pageSize int) ([]*model.User, int64, error) {
	offset := (page - 1) * pageSize
	return s.userRepo.List(ctx, pageSize, offset)
}

// SetActive activates or deactivates a user.
func (s *UserService) SetActive(ctx context.Context, id uuid.UUID, active bool) error {
	return s.userRepo.UpdateStatus(ctx, id, active)
}

// ResetPassword sets a new password for a user.
func (s *UserService) ResetPassword(ctx context.Context, id uuid.UUID, newPassword string) error {
	hash, err := auth.HashPassword(newPassword)
	if err != nil {
		return err
	}
	return s.userRepo.UpdatePassword(ctx, id, hash)
}

// ListRoles returns all available roles.
func (s *UserService) ListRoles(ctx context.Context) ([]*model.Role, error) {
	return s.userRepo.ListRoles(ctx)
}
