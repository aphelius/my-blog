---
author: Alphalius
pubDatetime: 2026-06-26T10:00:00.000Z
title: 深入理解 Spring Boot 的启动流程
slug: spring-boot-startup-process
featured: true
draft: false
tags:
  - Spring Boot
  - Java
  - 源码
description: 从一行 SpringApplication.run() 出发，拆解 Spring Boot 启动背后真正发生的事——环境准备、上下文刷新、自动配置与内嵌容器的启动。
---

我们写的每一个 Spring Boot 应用，入口几乎都长这样：

```java
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

一行 `SpringApplication.run()`，应用就跑起来了。但这行代码背后到底做了什么？为什么加个 `@SpringBootApplication` 注解就能自动装配一大堆 Bean？内嵌的 Tomcat 又是什么时候启动的？

这篇文章面向有 Spring 基础的读者，把启动流程拆成几个关键阶段讲清楚。

## Table of contents

## 一、`run()` 之前：构造 SpringApplication

`SpringApplication.run()` 是个静态方法，它其实分两步：先 `new` 一个 `SpringApplication` 实例，再调用实例的 `run()` 方法。

```java
public static ConfigurableApplicationContext run(Class<?>[] primarySources, String[] args) {
    return new SpringApplication(primarySources).run(args);
}
```

构造阶段主要确定了三件事：

1. **推断应用类型（`WebApplicationType`）**。Spring Boot 通过检查 classpath 上是否存在特定的类来判断：
   - 有 `DispatcherHandler` → `REACTIVE`（WebFlux）
   - 有 `DispatcherServlet` 等 Servlet 相关类 → `SERVLET`（Spring MVC）
   - 都没有 → `NONE`（普通应用，不启动 Web 容器）

2. **加载 `ApplicationContextInitializer` 和 `ApplicationListener`**。这两类扩展点通过 `spring.factories`（`META-INF/spring.factories`）机制从所有 jar 中扫描加载。这是 Spring Boot SPI 的核心——后面的自动配置也靠它。

3. **推断 main 方法所在的主类**，用于后续日志打印等。

> 关键点：应用类型的判断只看 classpath。换句话说，你引入哪个 starter，就决定了 Spring Boot 以哪种形态启动。

## 二、`run()` 的主干流程

实例方法 `run()` 是整个启动的指挥中心，核心步骤如下（省略了计时、异常处理等）：

```java
public ConfigurableApplicationContext run(String... args) {
    // 1. 启动监听器，广播 ApplicationStartingEvent
    SpringApplicationRunListeners listeners = getRunListeners(args);
    listeners.starting();

    // 2. 准备环境（Environment）
    ConfigurableEnvironment environment = prepareEnvironment(listeners, args);

    // 3. 打印 Banner
    Banner printedBanner = printBanner(environment);

    // 4. 创建 ApplicationContext
    ConfigurableApplicationContext context = createApplicationContext();

    // 5. 准备上下文（注册主类、执行 Initializer）
    prepareContext(context, environment, listeners, args, printedBanner);

    // 6. 刷新上下文（核心中的核心）
    refreshContext(context);

    // 7. 刷新后处理
    afterRefresh(context, args);

    // 8. 广播 ApplicationStartedEvent
    listeners.started(context);

    // 9. 执行 Runner
    callRunners(context, args);

    // 10. 广播 ApplicationReadyEvent
    listeners.running(context);

    return context;
}
```

下面挑几个关键阶段展开。

### 2.1 准备环境

`prepareEnvironment()` 负责把所有配置源整合成一个 `Environment` 对象，包括：命令行参数、`application.yml` / `application.properties`、系统环境变量、JVM 参数等，并按优先级排序。

这一步完成后会广播 `ApplicationEnvironmentPreparedEvent`。著名的配置加载组件 `ConfigFileApplicationListener`（新版本为 `ConfigDataEnvironmentPostProcessor`）就在这个时机读取你的配置文件，所以**此后 `@Value`、`@ConfigurationProperties` 才有值可注入**。

### 2.2 创建并准备上下文

`createApplicationContext()` 根据第一步推断的应用类型，创建对应的上下文实现：

| 应用类型 | ApplicationContext |
| --- | --- |
| SERVLET | `AnnotationConfigServletWebServerApplicationContext` |
| REACTIVE | `AnnotationConfigReactiveWebServerApplicationContext` |
| NONE | `AnnotationConfigApplicationContext` |

注意 Web 类型用的是 `WebServerApplicationContext`——这正是内嵌容器能被启动的前提。

随后 `prepareContext()` 把主类作为配置类注册进容器（注册的是 BeanDefinition，还没实例化），并依次执行前面加载的 `ApplicationContextInitializer`。

## 三、refresh：真正的核心

`refreshContext()` 最终调用的是 Spring 框架自身的 `AbstractApplicationContext#refresh()`。这是 Spring IoC 容器的标准启动模板方法，Spring Boot 在这里和传统 Spring 走到了同一条路上。`refresh()` 内部有十来个步骤，对启动流程最关键的有两个：

### 3.1 invokeBeanFactoryPostProcessors —— 自动配置在这里发生

`@SpringBootApplication` 是个组合注解，其中最关键的是 `@EnableAutoConfiguration`，它通过 `@Import` 导入了 `AutoConfigurationImportSelector`。

在 `refresh()` 的 `invokeBeanFactoryPostProcessors` 阶段，`ConfigurationClassPostProcessor` 会处理所有配置类，触发这个 Selector。它做的事情是：

1. 从 `META-INF/spring.factories`（新版本为 `META-INF/spring/...AutoConfiguration.imports`）中读取所有候选自动配置类；
2. 根据 `@Conditional` 系列条件注解（`@ConditionalOnClass`、`@ConditionalOnMissingBean` 等）**逐一过滤**，只保留满足条件的；
3. 把幸存下来的配置类注册为 BeanDefinition。

这就是"自动装配"的真相：**一堆带条件的配置类，按 classpath 和已有 Bean 的情况按需生效**。比如你引入了 `spring-boot-starter-web`，`DispatcherServletAutoConfiguration` 的条件成立，于是 MVC 相关 Bean 被自动配置好。

### 3.2 onRefresh —— 启动内嵌容器

`onRefresh()` 是模板方法里留给子类的扩展点。`ServletWebServerApplicationContext` 重写了它，在这里调用 `createWebServer()`，**创建并启动内嵌的 Tomcat / Jetty / Undertow**。

所以记住这个顺序：**先完成大部分 Bean 的定义注册，再在 `onRefresh()` 里把 Web 容器拉起来**。容器启动后，端口开始监听，但此时还没到"完全就绪"。

### 3.3 finishRefresh

`refresh()` 的最后一步会广播容器内部的 `ContextRefreshedEvent`，并发布 `WebServerInitializedEvent`。到这里，单例 Bean 已经全部实例化完成（非懒加载的）。

## 四、收尾：Runner 与 Ready 事件

回到 `run()` 方法，`refresh()` 之后：

- **`callRunners()`** 会执行所有 `ApplicationRunner` 和 `CommandLineRunner` 实现。如果你需要"应用启动完成后立刻跑一段初始化逻辑"，实现这两个接口是最规范的做法，比在 `@PostConstruct` 里写更合适——因为此时整个上下文已经 ready。
- 最后广播 **`ApplicationReadyEvent`**。监听这个事件，意味着应用已经完全可以对外提供服务。

## 五、把整个流程串起来

```
SpringApplication.run()
│
├─ new SpringApplication()       // 推断应用类型、加载 Initializer/Listener
│
└─ run()
   ├─ ApplicationStartingEvent
   ├─ prepareEnvironment()        // 加载配置 → EnvironmentPreparedEvent
   ├─ createApplicationContext()  // 按类型创建上下文
   ├─ prepareContext()            // 注册主类、执行 Initializer
   ├─ refresh()  ★核心
   │   ├─ invokeBeanFactoryPostProcessors()  // 自动配置 + 条件过滤
   │   ├─ onRefresh()                         // 启动内嵌 Tomcat
   │   ├─ 实例化单例 Bean
   │   └─ finishRefresh()                     // ContextRefreshedEvent
   ├─ ApplicationStartedEvent
   ├─ callRunners()               // CommandLineRunner / ApplicationRunner
   └─ ApplicationReadyEvent       // 应用就绪
```

## 小结

Spring Boot 的启动流程，本质上可以归纳成三句话：

1. **`run()` 之前**靠 classpath 推断形态、靠 `spring.factories` 加载扩展点；
2. **`refresh()` 之中**完成自动配置（条件化的配置类）和内嵌容器启动，这是绝对的核心；
3. **`refresh()` 之后**执行 Runner、广播 Ready 事件，应用正式对外服务。

理解了这条主线，再去看那些扩展点（事件监听、`BeanPostProcessor`、自定义 starter），就不会迷失在源码里——你随时知道自己站在启动流程的哪一段。

下一篇我打算挑其中的「自动配置」单独展开，写写如何手写一个 starter。如果你对某个阶段特别感兴趣，欢迎留言告诉我。
