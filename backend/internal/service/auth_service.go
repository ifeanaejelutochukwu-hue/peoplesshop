// Package service contains business logic, separated from HTTP and database layers.
package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/Peoplesshop/backend/internal/auth"
	"github.com/Peoplesshop/backend/internal/model"
	"github.com/Peoplesshop/backend/internal/repository"
	"github.com/google/uuid"
)

// AuthService handles authentication business logic.
type AuthService struct {
	userRepo *repository.UserRepository
	jwtSvc   *auth.JWTService
}

func NewAuthService(userRepo *repository.UserRepository, jwtSvc *auth.JWTService) *AuthService {
	return &AuthService{
		userRepo: userRepo,
		jwtSvc:   jwtSvc,
	}
}

// LoginRequest holds login credentials.
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse holds the token pair and user info.
type LoginResponse struct {
	User         *model.User      `json:"user"`
	Tokens       *auth.TokenPair  `json:"tokens"`
	Permissions  []string         `json:"permissions"`
}

// Login authenticates a user and returns a token pair.
func (s *AuthService) Login(ctx context.Context, req LoginRequest) (*LoginResponse, error) {
	if req.Username == "" || req.Password == "" {
		return nil, errors.New("username and password are required")
	}

	user, err := s.userRepo.GetByUsername(ctx, req.Username)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("get user: %w", err)
	}

	if !user.IsActive {
		return nil, ErrAccountDisabled
	}

	if err := auth.CheckPassword(user.PasswordHash, req.Password); err != nil {
		return nil, ErrInvalidCredentials
	}

	tokens, err := s.jwtSvc.GenerateTokenPair(user.ID, user.Username, user.Role.Name)
	if err != nil {
		return nil, fmt.Errorf("generate tokens: %w", err)
	}

	// Store hashed refresh token
	tokenHash := auth.HashToken(tokens.RefreshToken)
	expiresAt := time.Now().Add(s.jwtSvc.RefreshExpiry())
	if err := s.userRepo.SaveRefreshToken(ctx, user.ID, tokenHash, expiresAt); err != nil {
		return nil, fmt.Errorf("save refresh token: %w", err)
	}

	// Update last login (non-critical, ignore error)
	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

	perms, err := s.userRepo.GetPermissions(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("get permissions: %w", err)
	}

	// Clear password hash before returning
	user.PasswordHash = ""

	return &LoginResponse{
		User:        user,
		Tokens:      tokens,
		Permissions: perms,
	}, nil
}

// Refresh validates a refresh token and issues a new token pair.
func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*auth.TokenPair, error) {
	claims, err := s.jwtSvc.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	tokenHash := auth.HashToken(refreshToken)
	_, err = s.userRepo.ValidateRefreshToken(ctx, tokenHash)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	// Revoke old refresh token (rotation)
	_ = s.userRepo.RevokeRefreshToken(ctx, tokenHash)

	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if !user.IsActive {
		return nil, ErrAccountDisabled
	}

	newTokens, err := s.jwtSvc.GenerateTokenPair(user.ID, user.Username, user.Role.Name)
	if err != nil {
		return nil, fmt.Errorf("generate tokens: %w", err)
	}

	newHash := auth.HashToken(newTokens.RefreshToken)
	expiresAt := time.Now().Add(s.jwtSvc.RefreshExpiry())
	if err := s.userRepo.SaveRefreshToken(ctx, user.ID, newHash, expiresAt); err != nil {
		return nil, fmt.Errorf("save refresh token: %w", err)
	}

	return newTokens, nil
}

// Logout revokes all refresh tokens for the user.
func (s *AuthService) Logout(ctx context.Context, userID uuid.UUID) error {
	return s.userRepo.RevokeAllUserTokens(ctx, userID)
}

// Me returns the current user's profile and permissions.
func (s *AuthService) Me(ctx context.Context, userID uuid.UUID) (*LoginResponse, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	perms, err := s.userRepo.GetPermissions(ctx, userID)
	if err != nil {
		return nil, err
	}
	user.PasswordHash = ""

	return &LoginResponse{User: user, Permissions: perms}, nil
}

// Sentinel errors
var (
	ErrInvalidCredentials = errors.New("invalid username or password")
	ErrAccountDisabled    = errors.New("account is disabled")
)
