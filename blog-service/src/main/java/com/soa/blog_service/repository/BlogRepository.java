package com.soa.blog_service.repository;

import com.soa.blog_service.model.Blog;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BlogRepository extends MongoRepository<Blog, String> {
    List<Blog> findAllByAuthorIdIn(List<String> authorIds);
}