package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"akademia-backend/internal/config"

	"github.com/golang-jwt/jwt/v5"
)

type studentClaims struct {
	UserID int
	Role   string
}

type enrollment struct {
	CourseID    string     `json:"course_id"`
	Status      string     `json:"status"`
	EnrolledAt  time.Time  `json:"enrolled_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

type lessonProgress struct {
	CourseID  string     `json:"course_id"`
	LessonID  string     `json:"lesson_id"`
	Completed bool       `json:"completed"`
	UpdatedAt time.Time  `json:"updated_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

func currentUser(r *http.Request) (studentClaims, error) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return studentClaims{}, errors.New("missing authorization token")
	}
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return studentClaims{}, errors.New("server JWT secret is not configured")
	}

	token, err := jwt.Parse(strings.TrimPrefix(header, "Bearer "), func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return studentClaims{}, errors.New("invalid or expired authorization token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return studentClaims{}, errors.New("invalid token claims")
	}
	userIDFloat, ok := claims["user_id"].(float64)
	if !ok {
		return studentClaims{}, errors.New("invalid user identity")
	}
	role, _ := claims["role"].(string)
	return studentClaims{UserID: int(userIDFloat), Role: role}, nil
}

func currentStudent(r *http.Request) (studentClaims, error) {
	claims, err := currentUser(r)
	if err != nil {
		return studentClaims{}, err
	}
	if claims.Role != "student" {
		return studentClaims{}, errors.New("this endpoint is available to students only")
	}
	return claims, nil
}

func writeStudentError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"message": message})
}

// StudentState returns the logged-in student's enrollment and lesson progress.
func StudentState(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}

	enrollments := make([]enrollment, 0)
	rows, err := config.DB.Query(`SELECT course_id, status, enrolled_at, completed_at FROM student_enrollments WHERE user_id = $1 ORDER BY enrolled_at DESC`, student.UserID)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not load enrollments")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var item enrollment
		if err := rows.Scan(&item.CourseID, &item.Status, &item.EnrolledAt, &item.CompletedAt); err != nil {
			writeStudentError(w, http.StatusInternalServerError, "Could not read enrollments")
			return
		}
		enrollments = append(enrollments, item)
	}

	progress := make([]lessonProgress, 0)
	rows, err = config.DB.Query(`SELECT course_id, lesson_id, completed, updated_at, completed_at FROM student_lesson_progress WHERE user_id = $1 ORDER BY updated_at DESC`, student.UserID)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not load lesson progress")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var item lessonProgress
		if err := rows.Scan(&item.CourseID, &item.LessonID, &item.Completed, &item.UpdatedAt, &item.CompletedAt); err != nil {
			writeStudentError(w, http.StatusInternalServerError, "Could not read lesson progress")
			return
		}
		progress = append(progress, item)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"enrollments": enrollments, "lesson_progress": progress})
}

// EnrollStudent creates an idempotent active enrollment for a course.
func EnrollStudent(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if r.Method == http.MethodGet {
		rows, err := config.DB.Query(`
			SELECT c.id, c.slug, c.title, COALESCE(c.description, ''), COALESCE(c.thumbnail_path, ''),
			       COALESCE(c.category, 'General'), COALESCE(c.difficulty, 'Beginner'),
			       COALESCE(u.name, 'Akademia Instructor'), se.status, se.enrolled_at, se.completed_at
			FROM student_enrollments se
			JOIN platform_courses c ON se.course_id = c.id
			JOIN users u ON u.id = c.instructor_id
			WHERE se.user_id = $1
			ORDER BY se.enrolled_at DESC`, student.UserID)
		if err != nil {
			writeStudentError(w, http.StatusInternalServerError, "Could not load enrolled courses")
			return
		}
		defer rows.Close()

		enrollments := make([]map[string]any, 0)
		for rows.Next() {
			var id, slug, title, description, thumbnail, category, difficulty, instructorName, status string
			var enrolledAt time.Time
			var completedAt *time.Time
			if err := rows.Scan(&id, &slug, &title, &description, &thumbnail, &category, &difficulty, &instructorName, &status, &enrolledAt, &completedAt); err != nil {
				writeStudentError(w, http.StatusInternalServerError, "Could not read enrolled courses")
				return
			}
			enrollments = append(enrollments, map[string]any{
				"course_id": id,
				"slug": slug,
				"title": title,
				"description": description,
				"thumbnail_url": thumbnail,
				"category": category,
				"difficulty": difficulty,
				"instructor_name": instructorName,
				"status": status,
				"enrolled_at": enrolledAt,
				"completed_at": completedAt,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"enrollments": enrollments})
		return
	}
	if r.Method != http.MethodPost {
		writeStudentError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var input struct { CourseID string `json:"course_id"` }
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || strings.TrimSpace(input.CourseID) == "" {
		writeStudentError(w, http.StatusBadRequest, "course_id is required")
		return
	}
	input.CourseID = strings.TrimSpace(input.CourseID)

	var item enrollment
	err = config.DB.QueryRow(`
		INSERT INTO student_enrollments (user_id, course_id, status)
		VALUES ($1, $2, 'in-progress')
		ON CONFLICT (user_id, course_id) DO UPDATE SET
			status = CASE WHEN student_enrollments.status = 'saved' THEN 'in-progress' ELSE student_enrollments.status END,
			updated_at = NOW()
		RETURNING course_id, status, enrolled_at, completed_at`, student.UserID, input.CourseID).
		Scan(&item.CourseID, &item.Status, &item.EnrolledAt, &item.CompletedAt)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not enroll in this course")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(item)
}

// SaveLessonProgress saves one lesson's completion and marks its course complete
// when the frontend confirms that every lesson in that course is complete.
func SaveLessonProgress(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	var input struct {
		CourseID       string `json:"course_id"`
		LessonID       string `json:"lesson_id"`
		Completed      bool   `json:"completed"`
		CourseComplete bool   `json:"course_complete"`
		DurationMinutes int   `json:"duration_minutes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || strings.TrimSpace(input.CourseID) == "" || strings.TrimSpace(input.LessonID) == "" {
		writeStudentError(w, http.StatusBadRequest, "course_id and lesson_id are required")
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not save progress")
		return
	}
	defer tx.Rollback()

	// Completing a lesson automatically creates an active enrollment if needed.
	if _, err = tx.Exec(`INSERT INTO student_enrollments (user_id, course_id, status) VALUES ($1, $2, 'in-progress') ON CONFLICT (user_id, course_id) DO NOTHING`, student.UserID, strings.TrimSpace(input.CourseID)); err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not save progress")
		return
	}

	var completedAt *time.Time
	if input.Completed {
		now := time.Now().UTC()
		completedAt = &now
	}
	_, err = tx.Exec(`
		INSERT INTO student_lesson_progress (user_id, course_id, lesson_id, completed, completed_at, duration_minutes)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id, lesson_id) DO UPDATE SET completed = EXCLUDED.completed, completed_at = EXCLUDED.completed_at, duration_minutes = EXCLUDED.duration_minutes, updated_at = NOW()`,
		student.UserID, strings.TrimSpace(input.CourseID), strings.TrimSpace(input.LessonID), input.Completed, completedAt, input.DurationMinutes)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not save lesson progress")
		return
	}

	// The backend owns completion status. Do not trust a browser-provided
	// course_complete flag: it can be stale if an instructor changes curriculum.
	courseID := strings.TrimSpace(input.CourseID)
	var totalLessons, completedLessons int
	if err = tx.QueryRow(`
		SELECT COUNT(*)
		FROM platform_lessons l
		JOIN platform_modules m ON m.id = l.module_id
		WHERE m.course_id = $1`, courseID).Scan(&totalLessons); err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not calculate course progress")
		return
	}
	if err = tx.QueryRow(`
		SELECT COUNT(*)
		FROM student_lesson_progress
		WHERE user_id = $1 AND course_id = $2 AND completed = TRUE`,
		student.UserID, courseID).Scan(&completedLessons); err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not calculate course progress")
		return
	}

	status := "in-progress"
	if totalLessons > 0 && completedLessons >= totalLessons {
		status = "completed"
		_, err = tx.Exec(`UPDATE student_enrollments
			SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
			WHERE user_id = $1 AND course_id = $2`, student.UserID, courseID)
	} else {
		_, err = tx.Exec(`UPDATE student_enrollments
			SET status = 'in-progress', completed_at = NULL, updated_at = NOW()
			WHERE user_id = $1 AND course_id = $2`, student.UserID, courseID)
	}
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not update course status")
		return
	}
	if err = tx.Commit(); err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not save progress")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"course_id": courseID, "lesson_id": input.LessonID, "completed": input.Completed,
		"course_status": status, "completed_lessons": completedLessons, "total_lessons": totalLessons,
	})
}

// CreateCourseFeedback stores feedback submitted by a student. Instructor/admin
// dashboards can consume this table through future protected reporting endpoints.
func CreateCourseFeedback(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	var input struct {
		CourseID string `json:"course_id"`
		Rating   int    `json:"rating"`
		Message  string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || strings.TrimSpace(input.CourseID) == "" || strings.TrimSpace(input.Message) == "" || input.Rating < 1 || input.Rating > 5 {
		writeStudentError(w, http.StatusBadRequest, "course_id, a rating from 1 to 5, and a message are required")
		return
	}
	var id int
	err = config.DB.QueryRow(`INSERT INTO course_feedback (student_id, course_id, rating, message) VALUES ($1, $2, $3, $4) RETURNING id`, student.UserID, strings.TrimSpace(input.CourseID), input.Rating, strings.TrimSpace(input.Message)).Scan(&id)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not submit feedback")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "message": "Feedback submitted"})
}

func ListCourseFeedback(w http.ResponseWriter, r *http.Request) {
	viewer, err := currentUser(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if viewer.Role != "admin" && viewer.Role != "instructor" {
		writeStudentError(w, http.StatusForbidden, "only instructors and admins can view course feedback")
		return
	}

	// Optional filter: a specific course_id narrows the results to one course.
	filterCourseID := strings.TrimSpace(r.URL.Query().Get("course_id"))

	query := `
		SELECT f.id, f.course_id, COALESCE(c.title, f.course_id) AS course_title,
		       f.rating, f.message, f.created_at, u.name
		FROM course_feedback f
		JOIN users u ON u.id = f.student_id
		LEFT JOIN platform_courses c ON c.id = f.course_id`
	args := []interface{}{}
	if viewer.Role == "instructor" {
		query += ` JOIN course_instructors ci ON ci.course_id = f.course_id WHERE ci.instructor_user_id = $1`
		args = append(args, viewer.UserID)
		if filterCourseID != "" {
			query += ` AND f.course_id = $2`
			args = append(args, filterCourseID)
		}
	} else {
		// admin
		if filterCourseID != "" {
			query += ` WHERE f.course_id = $1`
			args = append(args, filterCourseID)
		}
	}
	query += ` ORDER BY f.created_at DESC`

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not load feedback")
		return
	}
	defer rows.Close()
	items := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id int
		var courseID, courseTitle, message, studentName string
		var rating int
		var createdAt time.Time
		if err := rows.Scan(&id, &courseID, &courseTitle, &rating, &message, &createdAt, &studentName); err != nil {
			writeStudentError(w, http.StatusInternalServerError, "Could not read feedback")
			return
		}
		items = append(items, map[string]interface{}{
			"id": id, "course_id": courseID, "course_title": courseTitle,
			"rating": rating, "message": message,
			"created_at": createdAt, "student_name": studentName,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"feedback": items})
}
