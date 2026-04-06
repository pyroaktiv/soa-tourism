package com.soa.blog_service.service;

import com.soa.blog_service.model.Blog;
import com.soa.blog_service.model.Comment;
import com.soa.blog_service.repository.BlogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BlogService {

    private final BlogRepository blogRepository;

    public Blog createBlog(Blog blog) {
        blog.setCreationDate(LocalDateTime.now());
        return blogRepository.save(blog);
    }

    public List<Blog> getAllBlogs() {
        return blogRepository.findAll();
    }

    public Blog addComment(String blogId, Comment comment) {
        Blog blog = blogRepository.findById(blogId)
                .orElseThrow(() -> new RuntimeException("Blog sa ID-jem " + blogId + " nije pronađen!"));

        comment.setCreatedAt(LocalDateTime.now());
        comment.setLastModifiedAt(LocalDateTime.now());

        blog.getComments().add(comment);

        return blogRepository.save(blog);
    }
}