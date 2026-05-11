import { Router, Request, Response } from "express";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "member";
  bio?: string;
}

export interface CreateUserBody {
  name: string;
  email: string;
  role: "admin" | "member";
  bio?: string;
}

export interface UpdateUserBody {
  name?: string;
  email?: string;
  role?: "admin" | "member";
  bio?: string;
}

let users: User[] = [];
let nextId = 1;

const router = Router();

// GET /users - Get All Users
router.get("/", (req: Request, res: Response<User[]>) => {
  return res.status(200).json(users);
});

// GET /:id - Get a Single User
router.get(
  "/:id",
  (req: Request<{ id: string }>, res: Response<User | { error: string }>) => {
    const id = parseInt(req.params.id, 10);
    const user = users.find((u) => u.id === id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }
    return res.status(200).json(user);
  },
);

// POST /users - Create a user
router.post(
  "/",
  (
    req: Request<{}, {}, CreateUserBody>,
    res: Response<User | { error: string }>,
  ) => {
    const { name, email, role, bio } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({
        error: "Name, email, and role required",
      });
    }

    const newUser: User = {
      id: nextId++,
      name,
      email,
      role,
      ...(bio !== undefined ? { bio } : {}),
    };

    users.push(newUser);
    return res.status(201).json(newUser);
  },
);

// PUT /users/:id - Update a user
router.put(
  "/:id",
  (
    req: Request<{ id: string }, {}, UpdateUserBody>,
    res: Response<User | { error: string }>,
  ) => {
    const id = parseInt(req.params.id, 10);
    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({
        error: "user not found",
      });
    }

    const updatedUser: User = {
      ...users[userIndex]!,
      ...req.body,
    };

    users[userIndex] = updatedUser;
    return res.status(200).json(updatedUser);
  },
);

// DELETE /users/:id - Delete a user
router.delete(
  "/:id",
  (
    req: Request<{ id: string }>,
    res: Response<{ message: string } | { error: string }>,
  ) => {
    const id = parseInt(req.params.id, 10);
    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return res.status(400).json({
        error: "User not found",
      });
    }

    users.splice(userIndex, 1);
    return res.status(200).json({
      message: "User deleted",
    });
  },
);

export default router;